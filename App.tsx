import React, { useState, useEffect, useMemo } from 'react';
import Spinner from './components/Spinner';
import SearchIcon from './components/icons/SearchIcon';
import ClearIcon from './components/icons/ClearIcon';
import RefreshIcon from './components/icons/RefreshIcon';
import { StudentApiResponse, FilterOptionsResponse, Attendance, AttendanceStatus } from './types';

// IMPORTANT: Replace with your actual n8n webhook URL
const WEBHOOK_URL = "https://fennecstor.art/webhook-test/rihab";

const App: React.FC = () => {
    // State for UI and data
    const [students, setStudents] = useState<string[]>([]);
    const [attendance, setAttendance] = useState<Attendance>({});
    const [filterOptions, setFilterOptions] = useState<{ teachers: string[], levels: string[] }>({ teachers: [], levels: [] });
    
    // State for filters and search
    const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
    const [selectedLevel, setSelectedLevel] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sessionName, setSessionName] = useState<string>('');
    
    // State for tracking current displayed filters
    const [activeFilters, setActiveFilters] = useState<{ teacher: string, level: string } | null>(null);

    // State for loading and errors
    const [isLoading, setIsLoading] = useState<boolean>(true); // True on initial load for filters
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [submitStatus, setSubmitStatus] = useState<{ success: boolean; message: string } | null>(null);

    // Fetch filter options on component mount
    useEffect(() => {
        const fetchFilterOptions = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const url = new URL(WEBHOOK_URL);
                url.searchParams.append('action', 'get_filters');
                const response = await fetch(url.toString());
                if (!response.ok) {
                    throw new Error(`خطأ في الشبكة: ${response.statusText}`);
                }
                const data: FilterOptionsResponse = await response.json();
                if (data && data.teachers && data.levels) {
                    setFilterOptions(data);
                } else {
                    throw new Error("لم يتم العثور على بيانات المعلمين أو المستويات. تأكد من أن n8n يعمل بشكل صحيح.");
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير معروف أثناء جلب الفلاتر.';
                setError(`فشل تحميل خيارات التصفية: ${errorMessage}`);
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFilterOptions();
    }, []);

    // Function to fetch students based on filters
    const fetchStudents = async () => {
        if (selectedTeacher === 'all' || selectedLevel === 'all') {
            setError("يرجى اختيار المعلم والمستوى أولاً.");
            setStudents([]);
            setActiveFilters(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        setStudents([]);
        setSubmitStatus(null);
        try {
            const url = new URL(WEBHOOK_URL);
            url.searchParams.append('action', 'get_students');
            url.searchParams.append('teacher', selectedTeacher);
            url.searchParams.append('level', selectedLevel);
            
            const response = await fetch(url.toString());
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`خطأ في الشبكة: ${response.statusText} - ${errorData}`);
            }

            const data: StudentApiResponse = await response.json();
            
            if (data && Array.isArray(data.students)) {
                const studentList = data.students;
                setStudents(studentList);
                // Initialize attendance for new students
                const initialAttendance: Attendance = {};
                studentList.forEach(student => {
                    initialAttendance[student] = 'Present';
                });
                setAttendance(initialAttendance);
                setActiveFilters({ teacher: selectedTeacher, level: selectedLevel });
            } else {
                setStudents([]);
                // This is not an error, just no students found
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير معروف.';
            setError(`فشل تحميل قائمة الطلاب: ${errorMessage}`);
            setActiveFilters(null);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Handle attendance status cycle
    const handleAttendanceChange = (studentName: string) => {
        setAttendance(prev => {
            const currentStatus = prev[studentName];
            let nextStatus: AttendanceStatus;
            if (currentStatus === 'Present') {
                nextStatus = 'Absent';
            } else if (currentStatus === 'Absent') {
                nextStatus = 'Late';
            } else {
                nextStatus = 'Present';
            }
            return { ...prev, [studentName]: nextStatus };
        });
    };

    // Handle attendance submission
    const handleSubmitAttendance = async () => {
        if (!sessionName.trim()) {
            setSubmitStatus({ success: false, message: "الرجاء إدخال اسم الجلسة." });
            return;
        }
        if (filteredStudents.length === 0) {
            setSubmitStatus({ success: false, message: "لا يوجد طلاب في القائمة لإرسال الحضور." });
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);
        setError(null);

        const presentCount = Object.values(attendance).filter(s => s === 'Present').length;
        const absentCount = Object.values(attendance).filter(s => s === 'Absent').length;
        const lateCount = Object.values(attendance).filter(s => s === 'Late').length;

        const payload = {
            action: "submit_attendance",
            teacher: activeFilters?.teacher,
            level: activeFilters?.level,
            session: sessionName,
            timestamp: new Date().toISOString(),
            students: Object.entries(attendance).map(([name, status]) => ({ name, status })),
            totalStudents: students.length,
            presentCount,
            absentCount,
            lateCount,
        };

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ body: payload }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`فشل الإرسال: ${errorText}`);
            }

            await response.json();
            setSubmitStatus({ success: true, message: "تم تسجيل الحضور بنجاح!" });
            setSessionName(''); // Clear session name on success

        } catch (err) {
             const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع.';
             setSubmitStatus({ success: false, message: errorMessage });
             console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredStudents = useMemo(() => {
        return students.filter(student =>
            student.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [students, searchTerm]);

    const attendanceSummary = useMemo(() => {
        const present = filteredStudents.filter(s => attendance[s] === 'Present').length;
        const absent = filteredStudents.filter(s => attendance[s] === 'Absent').length;
        const late = filteredStudents.filter(s => attendance[s] === 'Late').length;
        return { present, absent, late };
    }, [attendance, filteredStudents]);
    
    const getStatusColor = (status: AttendanceStatus) => {
        switch (status) {
            case 'Present': return 'bg-green-500 hover:bg-green-600';
            case 'Absent': return 'bg-red-500 hover:bg-red-600';
            case 'Late': return 'bg-yellow-500 hover:bg-yellow-600';
            default: return 'bg-gray-500 hover:bg-gray-600';
        }
    };
    
    const handleClearAll = () => {
        const clearedAttendance: Attendance = {};
        students.forEach(student => {
            clearedAttendance[student] = 'Present';
        });
        setAttendance(clearedAttendance);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex justify-center">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <header className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">نظام تسجيل حضور الطلاب</h1>
                    <p className="text-gray-500 mt-2">اختر المعلم والمستوى لعرض الطلاب وتسجيل الحضور</p>
                </header>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label htmlFor="teacher-select" className="block text-sm font-medium text-gray-700 mb-1">المعلم</label>
                        <select
                            id="teacher-select"
                            value={selectedTeacher}
                            onChange={(e) => setSelectedTeacher(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">اختر معلماً</option>
                            {filterOptions.teachers.map(teacher => <option key={teacher} value={teacher}>{teacher}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="level-select" className="block text-sm font-medium text-gray-700 mb-1">المستوى</label>
                        <select
                            id="level-select"
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">اختر مستوى</option>
                            {filterOptions.levels.map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={fetchStudents}
                        disabled={isLoading || selectedTeacher === 'all' || selectedLevel === 'all'}
                        className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'جاري التحميل...' : 'تصفية'}
                    </button>
                </div>
                
                {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert"><p>{error}</p></div>}
                
                {isLoading && !activeFilters && <Spinner />}

                {activeFilters && !isLoading && (
                <div className="mt-8">
                    <div className="p-3 bg-blue-50 rounded-md border border-blue-200 text-center mb-4">
                        <p className="text-blue-800">
                            عرض الطلاب لـ <span className="font-bold">{activeFilters.teacher}</span> - المستوى <span className="font-bold">{activeFilters.level}</span>
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="relative flex-grow">
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <SearchIcon className="w-5 h-5 text-gray-400" />
                            </span>
                            <input
                                type="text"
                                placeholder="ابحث عن طالب..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                             <button onClick={handleClearAll} className="flex items-center gap-2 bg-yellow-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-yellow-600 transition">
                                <ClearIcon className="w-5 h-5" /> مسح الكل
                            </button>
                            <button onClick={fetchStudents} className="flex items-center gap-2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-gray-700 transition">
                                <RefreshIcon className="w-5 h-5" /> تحديث القائمة
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center">
                        <div className="p-3 bg-gray-100 rounded-md"><span className="font-bold text-lg">{filteredStudents.length}</span><span className="block text-sm text-gray-600">الإجمالي</span></div>
                        <div className="p-3 bg-green-100 rounded-md"><span className="font-bold text-lg text-green-800">{attendanceSummary.present}</span><span className="block text-sm text-green-700">حاضر</span></div>
                        <div className="p-3 bg-red-100 rounded-md"><span className="font-bold text-lg text-red-800">{attendanceSummary.absent}</span><span className="block text-sm text-red-700">غائب</span></div>
                        <div className="p-3 bg-yellow-100 rounded-md"><span className="font-bold text-lg text-yellow-800">{attendanceSummary.late}</span><span className="block text-sm text-yellow-700">متأخر</span></div>
                    </div>

                    <ul className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                        {filteredStudents.length > 0 ? filteredStudents.map((student, index) => (
                            <li key={index} className="flex items-center justify-between p-3 bg-white border rounded-md shadow-sm transition hover:bg-gray-50">
                                <span className="text-gray-800 font-medium">{student}</span>
                                <button
                                    onClick={() => handleAttendanceChange(student)}
                                    className={`text-white font-bold py-1 px-4 rounded-full text-sm transition ${getStatusColor(attendance[student])}`}
                                >
                                    {attendance[student] === 'Present' && 'حاضر'}
                                    {attendance[student] === 'Absent' && 'غائب'}
                                    {attendance[student] === 'Late' && 'متأخر'}
                                </button>
                            </li>
                        )) : (
                            <li className="text-center text-gray-500 p-4">لم يتم العثور على طلاب لهذه التصفية.</li>
                        )}
                    </ul>
                    
                    {students.length > 0 && (
                        <div className="mt-8 pt-6 border-t">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                 <input
                                    type="text"
                                    placeholder="اسم الجلسة (مثال: حلقة الفجر)"
                                    value={sessionName}
                                    onChange={e => setSessionName(e.target.value)}
                                    className="md:col-span-2 w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <button
                                    onClick={handleSubmitAttendance}
                                    disabled={isSubmitting}
                                    className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition disabled:bg-gray-400"
                                >
                                    {isSubmitting ? 'جاري الإرسال...' : 'تسجيل الحضور'}
                                </button>
                             </div>
                             {submitStatus && (
                                <p className={`mt-4 text-center text-sm font-medium ${submitStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                                    {submitStatus.message}
                                </p>
                             )}
                        </div>
                    )}

                </div>
                )}
            </div>
        </div>
    );
};

export default App;
