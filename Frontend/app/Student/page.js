"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentPage() {
  const router = useRouter();

  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem("student_id");
    const savedName = localStorage.getItem("student_name");

    if (!savedId) {
      router.push("/");
      return;
    }

    setStudentId(savedId);
    setStudentName(savedName || "Student");
    fetchStudentAttendance(savedId);
  }, []);

  async function fetchStudentAttendance(id) {
    try {
      const res = await fetch(`http://127.0.0.1:8000/attendance/student/${id}`);
      const data = await res.json();
      setAttendance(data);
    } catch {
      setAttendance([]);
    }
  }

  async function markAttendance() {
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("face_image", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/attendance/mark", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);

      if (studentId) {
        fetchStudentAttendance(studentId);
      }
    } catch {
      setResult({
        status: "error",
        message: "Could not connect to server.",
      });
    }

    setLoading(false);
  }

  function logout() {
    localStorage.removeItem("student_id");
    localStorage.removeItem("student_name");
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold">Student Dashboard</h1>
            <p className="text-gray-600">Welcome, {studentName}</p>
            <p className="text-gray-500">Student ID: {studentId}</p>
          </div>

          <button
            onClick={logout}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold mb-4">Mark Attendance</h2>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
              className="mb-4"
            />

            {file && (
              <img
                src={URL.createObjectURL(file)}
                alt="preview"
                className="mb-4 w-full rounded"
              />
            )}

            <button
              onClick={markAttendance}
              disabled={!file || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:bg-gray-400"
            >
              {loading ? "Processing..." : "Mark Me Present"}
            </button>

            {result && (
              <div className="mt-4">
                {result.status === "present" ? (
                  <div className="p-4 bg-green-100 text-green-800 rounded">
                    <h3 className="text-xl font-bold">✅ Attendance Marked</h3>
                    <p>Name: {result.student}</p>
                    <p>Student ID: {result.student_id || studentId}</p>
                    <p>Confidence: {result.confidence}</p>
                  </div>
                ) : result.status === "unknown" ? (
                  <div className="p-4 bg-red-100 text-red-800 rounded">
                    <h3 className="text-xl font-bold">❌ Face Not Recognized</h3>
                    <p>{result.message}</p>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-100 text-yellow-800 rounded">
                    <p>{result.message}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold mb-4">My Attendance History</h2>

            <button
              onClick={() => fetchStudentAttendance(studentId)}
              className="bg-gray-800 text-white px-4 py-2 rounded mb-4"
            >
              Refresh
            </button>

            <div className="overflow-x-auto">
              <table className="w-full border text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2 text-left">Status</th>
                    <th className="border p-2 text-left">Date</th>
                    <th className="border p-2 text-left">Time</th>
                  </tr>
                </thead>

                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td className="border p-2" colSpan="3">
                        No attendance records found.
                      </td>
                    </tr>
                  ) : (
                    attendance.map((record) => (
                      <tr key={record.id}>
                        <td className="border p-2">{record.status}</td>
                        <td className="border p-2">
                          {new Date(record.marked_at).toLocaleDateString()}
                        </td>
                        <td className="border p-2">
                          {new Date(record.marked_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-2">Attendance Summary</h2>
            <p>Total Present Days: {attendance.length}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-2">Leave Request</h2>
            <p className="text-gray-600 mb-3">Coming soon.</p>
            <button className="bg-gray-400 text-white px-4 py-2 rounded" disabled>
              Request Leave
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-2">Profile</h2>
            <p>Name: {studentName}</p>
            <p>ID: {studentId}</p>
          </div>
        </div>
      </div>
    </main>
  );
}