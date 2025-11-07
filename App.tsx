import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ApiResponseItem } from './types';
import Spinner from './components/Spinner';
import RefreshIcon from './components/icons/RefreshIcon';
import SearchIcon from './components/icons/SearchIcon';
import ClearIcon from './components/icons/ClearIcon';

const WEBHOOK_URL = "https://fennecstor.art/webhook-test/rihab";
type AttendanceStatus = 'present' | 'absent' | 'late';

const statusConfig: Record<AttendanceStatus, { label: string; classes: string }> = {
  present: { label: 'حاضر', classes: 'bg-green-100 text-green-800 hover:bg-green-200 focus:ring-green-500' },
  absent: { label: 'غائب', classes: 'bg-red-100 text-red-800 hover:bg-red-200 focus:ring-red-500' },
  late: { label: 'متأخر', classes: 'bg-orange-100 text-orange-800 hover:bg-orange-200 focus:ring-orange-500' },
};

const App: React.FC = () => {
  const [students, setStudents] = useState<string[]>([]);
  const [teacher, setTeacher] = useState<string>('all');
  const [level, setLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for attendance
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [session, setSession] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const teacherOptions: { [key: string]: string } = {
    'all': 'الكل',
    'teacher_a': 'أستاذ/ة أ',
    'teacher_b': 'أستاذ/ة ب',
  };

  const levelOptions: { [key: string]: string } = {
    'all': 'الكل',
    'level_1': 'المستوى الأول',
    'level_2': 'المستوى الثاني',
  };

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSubmitMessage(null);
    try {
      const url = new URL(WEBHOOK_URL);
      url.searchParams.append('action', 'get_students');
      
      // Always send teacher and level to prevent n8n workflow error
      url.searchParams.append('teacher', teacher);
      url.searchParams.append('level', level);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('فشل في جلب البيانات من الخادم.');
      }
      const data: any[] = await response.json();

      if (Array.isArray(data) && data.length > 0 && data[0].error) {
        throw new Error(data[0].error);
      }

      if (!Array.isArray(data) || data.length === 0 || !data[0].students || !Array.isArray(data[0].students)) {
        // If the workflow returns an empty array, it means no students were found. Treat this as a valid but empty response.
        setStudents([]);
        setAttendance({});
        setIsLoading(false);
        return;
      }
      
      const studentList = (data as ApiResponseItem[])[0].students;
      setStudents(studentList);

      // Initialize attendance state, defaulting all to 'present'
      const initialAttendance: Record<string, AttendanceStatus> = {};
      studentList.forEach(student => {
        initialAttendance[student] = 'present';
      });
      setAttendance(initialAttendance);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('حدث خطأ غير متوقع.');
      }
      setStudents([]);
      setAttendance({});
    } finally {
      setIsLoading(false);
    }
  }, [teacher, level]);

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleAttendanceChange = (studentName: string, status: AttendanceStatus) => {
    setAttendance(prev => ({
      ...prev,
      [studentName]: status,
    }));
  };

  const statusCycle: AttendanceStatus[] = ['present', 'absent', 'late'];
  const handleQuickStatusChange = (studentName: string) => {
    const currentStatus = attendance[studentName];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];
    handleAttendanceChange(studentName, nextStatus); // Reuses existing logic
  };
  
  const handleClearAll = () => {
    setAttendance(prev => {
        const newAttendance = {...prev};
        filteredStudents.forEach(student => {
            newAttendance[student] = 'present';
        });
        return newAttendance;
    });
  };

  const handleSubmitAttendance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session.trim()) {
        setSubmitMessage({ type: 'error', text: 'الرجاء إدخال اسم الجلسة.' });
        return;
    }
    if(filteredStudents.length === 0) {
        setSubmitMessage({ type: 'error', text: 'لا يوجد طلاب لإرسال حضورهم.' });
        return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    const attendanceData = filteredStudents.map(name => ({ name, status: attendance[name] }));
    const presentCount = attendanceData.filter(s => s.status === 'present').length;
    const absentCount = attendanceData.filter(s => s.status === 'absent').length;
    const lateCount = attendanceData.filter(s => s.status === 'late').length;


    const payload = {
        action: "submit_attendance",
        teacher: teacher,
        level: level,
        session: session,
        timestamp: new Date().toISOString(),
        students: attendanceData,
        totalStudents: attendanceData.length,
        presentCount: presentCount,
        absentCount: absentCount,
        lateCount: lateCount
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('فشل إرسال بيانات الحضور.');
        }

        const result = await response.json();
        // Assuming n8n returns a success message on the first item
        if (result && result.message === 'Attendance recorded') {
             setSubmitMessage({ type: 'success', text: 'تم تسجيل الحضور بنجاح!' });
        } else {
            setSubmitMessage({ type: 'success', text: 'تم إرسال البيانات، ولكن لم يتم استلام تأكيد.' });
        }
       
    } catch (err) {
        if (err instanceof Error) {
            setSubmitMessage({ type: 'error', text: err.message });
        } else {
            setSubmitMessage({ type: 'error', text: 'حدث خطأ غير متوقع أثناء الإرسال.' });
        }
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const filteredStudents = useMemo(() => {
    if (!searchTerm) {
      return students;
    }
    return students.filter(student =>
      student.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const attendanceSummary = useMemo(() => {
    const statuses = filteredStudents.map(student => attendance[student]);
    return {
        total: statuses.length,
        present: statuses.filter(s => s === 'present').length,
        absent: statuses.filter(s => s === 'absent').length,
        late: statuses.filter(s => s === 'late').length,
    };
  }, [attendance, filteredStudents]);

  const renderContent = () => {
    if (isLoading) {
      return <Spinner />;
    }
    if (error) {
      return (
        <div className="bg-red-100 border-r-4 border-red-500 text-red-700 p-4 rounded-md m-4" role="alert">
          <p className="font-bold">خطأ</p>
          <p>{error}</p>
        </div>
      );
    }
    if (students.length === 0) {
        return <p className="text-center text-gray-500 py-10">لا يوجد طلاب لعرضهم بهذه الفلاتر.</p>;
    }
    if (filteredStudents.length === 0) {
        return <p className="text-center text-gray-500 py-10">لا يوجد طلاب يطابقون البحث.</p>;
    }
    return (
        <>
            <div className="p-4 bg-gray-50 border-b border-t text-sm text-gray-700 grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                <div><strong>الإجمالي:</strong> <span className="font-mono">{attendanceSummary.total}</span></div>
                <div className="text-green-600"><strong>حاضر:</strong> <span className="font-mono">{attendanceSummary.present}</span></div>
                <div className="text-red-600"><strong>غائب:</strong> <span className="font-mono">{attendanceSummary.absent}</span></div>
                <div className="text-orange-600"><strong>متأخر:</strong> <span className="font-mono">{attendanceSummary.late}</span></div>
            </div>
            <ul className="divide-y divide-gray-200">
                {filteredStudents.map((student) => {
                    const currentStatus = attendance[student] || 'present';
                    const config = statusConfig[currentStatus];
                    return (
                        <li key={student} className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors duration-200 ease-in-out hover:bg-blue-50">
                            <span className="font-medium text-gray-800">{student}</span>
                            <button
                                type="button"
                                onClick={() => handleQuickStatusChange(student)}
                                className={`px-4 py-1.5 w-24 text-center text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.classes}`}
                                aria-label={`تغيير حالة حضور ${student}. الحالة الحالية: ${config.label}`}
                            >
                                {config.label}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
  };

  return (
    <div className="bg-slate-100 min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">نظام تسجيل الحضور</h1>
          <p className="text-gray-600 mt-2">عرض الطلاب وتسجيل الحضور اليومي</p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="teacher" className="block text-sm font-medium text-gray-700 mb-1">المعلم</label>
              <select 
                id="teacher" 
                value={teacher} 
                onChange={(e) => setTeacher(e.target.value)}
                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(teacherOptions).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">المستوى</label>
              <select 
                id="level" 
                value={level} 
                onChange={(e) => setLevel(e.target.value)}
                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(levelOptions).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200">
              تصفية
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-auto flex-grow">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <SearchIcon className="text-gray-400"/>
              </span>
              <input
                type="text"
                placeholder="ابحث عن اسم الطالب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex w-full sm:w-auto gap-2">
              <button 
                onClick={handleClearAll}
                className="flex items-center gap-2 w-full sm:w-auto justify-center bg-yellow-200 text-yellow-800 py-2 px-4 rounded-md hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors duration-200"
              >
                <ClearIcon />
                <span>مسح الكل</span>
              </button>
              <button 
                onClick={() => fetchStudents()}
                className="flex items-center gap-2 w-full sm:w-auto justify-center bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors duration-200"
              >
                <RefreshIcon />
                <span>تحديث</span>
              </button>
            </div>
          </div>
          
          {!isLoading && !error && (
            <div className="p-3 bg-blue-50 border-b border-gray-200 text-sm text-blue-800" role="status" aria-live="polite">
              <p className="text-center">
                <span className="font-semibold">عرض النتائج لـ:</span>
                <span className="mx-2 font-medium">المعلم ({teacherOptions[teacher] || teacher})</span>
                <span className="font-light">|</span>
                <span className="mx-2 font-medium">المستوى ({levelOptions[level] || level})</span>
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            {renderContent()}
          </div>
            {!isLoading && !error && students.length > 0 && filteredStudents.length > 0 && (
                <form onSubmit={handleSubmitAttendance} className="p-4 bg-slate-50 border-t rounded-b-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <div className="md:col-span-2">
                            <label htmlFor="session" className="block text-sm font-medium text-gray-700 mb-1">اسم الجلسة</label>
                            <input 
                                type="text"
                                id="session"
                                value={session}
                                onChange={(e) => setSession(e.target.value)}
                                placeholder="مثال: حلقة الفجر، حصة التجويد..."
                                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed self-end"
                        >
                            {isSubmitting ? 'جاري الإرسال...' : 'تسجيل الحضور'}
                        </button>
                    </div>
                    {submitMessage && (
                        <div className={`mt-4 p-3 rounded-md text-sm ${submitMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {submitMessage.text}
                        </div>
                    )}
                </form>
            )}
        </div>

      </div>
    </div>
  );
};

export default App;