"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

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
    } catch (err) {
      setResult({ status: "error", message: "Failed to connect to server" });
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white text-black p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold mb-4">Who’sHere</h1>

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
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400 w-full"
        >
          {loading ? "Processing..." : "Mark Attendance"}
        </button>

        {result && (
          <div className="mt-6">
            {result.status === "present" ? (
              <div className="p-4 bg-green-100 text-green-800 rounded">
                <h2 className="text-xl font-bold">✅ Present</h2>
                <p>Name: {result.student}</p>
                <p>Roll: {result.roll_number}</p>
                <p>Confidence: {result.confidence}</p>
              </div>
            ) : result.status === "unknown" ? (
              <div className="p-4 bg-red-100 text-red-800 rounded">
                <h2 className="text-xl font-bold">❌ Unknown</h2>
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
    </main>
  );
}