export interface StudentApiResponse {
  students: string[];
}

export interface FilterOptionsResponse {
  teachers: string[];
  levels: string[];
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late';

export interface Attendance {
  [studentName: string]: AttendanceStatus;
}
