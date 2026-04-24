"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const router = useRouter();

  const [rollNumber, setRollNumber] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [message, setMessage] = useState("");

  async function studentLogin() {
    setMessage("");

    try {
      const res = await fetch(`http://127.0.0.1:8000/students/${rollNumber}`);

      if (!res.ok) {
        setMessage("You're not registered, please contact admin.");
        return;
      }

      localStorage.setItem("student_roll", rollNumber);
      router.push("/student");
    } catch {
      setMessage("Could not connect to server.");
    }
  }

  function adminLogin() {
    if (adminPassword === "admin123") {
      router.push("/admin");
    } else {
      setMessage("Invalid admin password.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6 text-black">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-4xl">
        <h1 className="text-4xl font-bold mb-2 text-center">Who’sHere</h1>
        <p className="text-center text-gray-600 mb-8">
          Smart Attendance System using Face Recognition
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border p-6 rounded-xl">
            <h2 className="text-2xl font-bold mb-4">Student Login</h2>

            <input
              type="text"
              placeholder="Enter Roll Number"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="border p-2 w-full mb-4 rounded"
            />

            <button
              onClick={studentLogin}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full"
            >
              Login as Student
            </button>
          </div>

          <div className="border p-6 rounded-xl">
            <h2 className="text-2xl font-bold mb-4">Administrator Login</h2>

            <input
              type="password"
              placeholder="Enter Admin Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="border p-2 w-full mb-4 rounded"
            />

            <button
              onClick={adminLogin}
              className="bg-green-600 text-white px-4 py-2 rounded w-full"
            >
              Login as Administrator
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-6 bg-red-100 text-red-800 p-4 rounded text-center">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}