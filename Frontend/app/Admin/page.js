"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = "http://127.0.0.1:8000";

function createEmptyStudentForm() {
  return {
    full_name: "",
    email: "",
    password: "",
    face_image: null,
  };
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export default function AdminPage() {
  const router = useRouter();
  const formSectionRef = useRef(null);

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [studentForm, setStudentForm] = useState(createEmptyStudentForm);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [studentMessage, setStudentMessage] = useState(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState(null);

  async function fetchStudents() {
    const res = await fetch(`${API_BASE_URL}/students`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Could not load students.");
    }

    setStudents(data);
  }

  async function fetchAttendance() {
    const res = await fetch(`${API_BASE_URL}/attendance`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Could not load attendance.");
    }

    setAttendance(data);
  }

  function showMessage(type, message) {
    setStudentMessage({ type, message });
  }

  function resetStudentForm() {
    setEditingStudentId(null);
    setStudentForm(createEmptyStudentForm());
  }

  function focusStudentForm() {
    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function logout() {
    router.push("/");
  }

  function openRegistrationForm() {
    resetStudentForm();
    showMessage("info", "Register a new student by filling in the form below.");
    focusStudentForm();
  }

  function startEditingStudent(student) {
    setEditingStudentId(student.student_id);
    setStudentForm({
      full_name: student.full_name || "",
      email: student.email || "",
      password: "",
      face_image: null,
    });
    showMessage(
      "info",
      `Editing ${student.full_name}. Leave password and face image blank to keep the current ones.`,
    );
    focusStudentForm();
  }

  async function handleStudentSubmit(event) {
    event.preventDefault();

    if (!studentForm.full_name.trim()) {
      showMessage("error", "Student name is required.");
      return;
    }

    if (!editingStudentId && !studentForm.password.trim()) {
      showMessage("error", "Password is required when registering a student.");
      return;
    }

    if (!editingStudentId && !studentForm.face_image) {
      showMessage("error", "Face image is required when registering a student.");
      return;
    }

    setIsSavingStudent(true);
    setStudentMessage(null);

    const formData = new FormData();
    formData.append("full_name", studentForm.full_name.trim());
    formData.append("email", studentForm.email.trim());

    if (studentForm.password.trim()) {
      formData.append("password", studentForm.password.trim());
    }

    if (studentForm.face_image) {
      formData.append("face_image", studentForm.face_image);
    }

    const endpoint = editingStudentId
      ? `${API_BASE_URL}/students/${editingStudentId}`
      : `${API_BASE_URL}/students/register`;

    const method = editingStudentId ? "PUT" : "POST";

    try {
      const res = await fetch(endpoint, {
        method,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Could not save student.");
      }

      await fetchStudents();
      resetStudentForm();
      showMessage("success", data.message || "Student saved successfully.");
    } catch (error) {
      showMessage("error", error.message || "Could not save student.");
    } finally {
      setIsSavingStudent(false);
    }
  }

  async function handleDeleteStudent(student) {
    const confirmed = window.confirm(
      `Delete ${student.full_name}? This will also remove the student's attendance records.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingStudentId(student.student_id);
    setStudentMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/students/${student.student_id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Could not delete student.");
      }

      if (editingStudentId === student.student_id) {
        resetStudentForm();
      }

      await Promise.all([fetchStudents(), fetchAttendance()]);
      showMessage("success", data.message || "Student deleted successfully.");
    } catch (error) {
      showMessage("error", error.message || "Could not delete student.");
    } finally {
      setDeletingStudentId(null);
    }
  }

  useEffect(() => {
    async function loadDashboard() {
      try {
        await Promise.all([fetchStudents(), fetchAttendance()]);
      } catch (error) {
        showMessage("error", error.message || "Could not load dashboard data.");
      }
    }

    loadDashboard();
  }, []);

  const filteredStudents = students.filter((student) =>
    `${student.student_id} ${student.full_name} ${student.email || ""}`
      .toLowerCase()
      .includes(studentSearch.toLowerCase()),
  );

  const filteredAttendance = attendance.filter((record) =>
    `${record.student_id} ${record.student_name} ${record.status}`
      .toLowerCase()
      .includes(attendanceSearch.toLowerCase()),
  );

  const messageClassName =
    studentMessage?.type === "error"
      ? "border border-red-200 bg-red-50 text-red-700"
      : studentMessage?.type === "success"
        ? "border border-green-200 bg-green-50 text-green-700"
        : "border border-blue-200 bg-blue-50 text-blue-700";

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              WhosHere Admin
            </p>
            <h1 className="text-4xl font-bold">Student Management Dashboard</h1>
            <p className="mt-2 text-slate-600">
              Register, update, delete, and review students from one place.
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Total Students</p>
            <p className="mt-3 text-3xl font-bold">{students.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Attendance Records</p>
            <p className="mt-3 text-3xl font-bold">{attendance.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Student Form Mode</p>
            <p className="mt-3 text-xl font-bold text-slate-800">
              {editingStudentId ? `Editing #${editingStudentId}` : "Registering new student"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.35fr]">
          <section
            ref={formSectionRef}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {editingStudentId ? "Edit Student" : "Register Student"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingStudentId
                    ? "Update the student details below."
                    : "Create a new student account and face profile."}
                </p>
              </div>

              <button
                type="button"
                onClick={openRegistrationForm}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                New Student
              </button>
            </div>

            {studentMessage ? (
              <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${messageClassName}`}>
                {studentMessage.message}
              </div>
            ) : null}

            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  type="text"
                  value={studentForm.full_name}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      full_name: event.target.value,
                    }))
                  }
                  placeholder="Enter student name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={studentForm.email}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Enter student email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Password {editingStudentId ? "(optional while editing)" : ""}
                </label>
                <input
                  type="password"
                  value={studentForm.password}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder={
                    editingStudentId
                      ? "Leave blank to keep existing password"
                      : "Create a student password"
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Face Image {editingStudentId ? "(optional while editing)" : ""}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      face_image: event.target.files?.[0] || null,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-white hover:file:bg-slate-700"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {studentForm.face_image
                    ? `Selected: ${studentForm.face_image.name}`
                    : editingStudentId
                      ? "Upload a new image only if you want to replace the stored face profile."
                      : "A clear front-facing photo works best."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSavingStudent
                    ? "Saving..."
                    : editingStudentId
                      ? "Update Student"
                      : "Register Student"}
                </button>

                {editingStudentId ? (
                  <button
                    type="button"
                    onClick={resetStudentForm}
                    className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Attendance Overview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search the attendance log by name, ID, or status.
                </p>
              </div>

              <button
                onClick={fetchAttendance}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
              >
                Refresh Attendance
              </button>
            </div>

            <input
              type="text"
              placeholder="Search attendance..."
              value={attendanceSearch}
              onChange={(event) => setAttendanceSearch(event.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500"
            />

            <div className="max-h-[28rem] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[38rem] text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="border-b border-slate-200 p-3">Student</th>
                    <th className="border-b border-slate-200 p-3">ID</th>
                    <th className="border-b border-slate-200 p-3">Status</th>
                    <th className="border-b border-slate-200 p-3">Marked At</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan="4">
                        No attendance records found.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((record) => (
                      <tr key={record.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border-b border-slate-100 p-3">{record.student_name}</td>
                        <td className="border-b border-slate-100 p-3">{record.student_id}</td>
                        <td className="border-b border-slate-100 p-3 capitalize">
                          {record.status}
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          {formatDateTime(record.marked_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Students Directory</h2>
              <p className="mt-1 text-sm text-slate-500">
                View every registered student and open edit or delete actions from the table.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 sm:w-72"
              />

              <button
                onClick={fetchStudents}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
              >
                Refresh Students
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="border-b border-slate-200 p-3">ID</th>
                  <th className="border-b border-slate-200 p-3">Name</th>
                  <th className="border-b border-slate-200 p-3">Email</th>
                  <th className="border-b border-slate-200 p-3">Created</th>
                  <th className="border-b border-slate-200 p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan="5">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.student_id} className="odd:bg-white even:bg-slate-50">
                      <td className="border-b border-slate-100 p-3 font-medium">
                        {student.student_id}
                      </td>
                      <td className="border-b border-slate-100 p-3">{student.full_name}</td>
                      <td className="border-b border-slate-100 p-3">
                        {student.email || "-"}
                      </td>
                      <td className="border-b border-slate-100 p-3">
                        {formatDateTime(student.created_at)}
                      </td>
                      <td className="border-b border-slate-100 p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingStudent(student)}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-white transition hover:bg-blue-700"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(student)}
                            disabled={deletingStudentId === student.student_id}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                          >
                            {deletingStudentId === student.student_id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
