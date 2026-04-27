"use client";

import { PencilLine, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PasswordField from "@/app/_components/PasswordField";
import { buildAssetUrl } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AdminShell from "../_components/AdminShell";
import {
  ADMIN_FIELD_CLASSNAME,
  AdminLoadingScreen,
  FieldBlock,
  FileInput,
  MessageBanner,
  NativeSelect,
  PageCard,
  PhotoPreviewCard,
  PhotoThumb,
  SectionIntro,
} from "../_components/AdminUI";
import {
  createStudentForm,
  deleteStudentRecord,
  fetchStudents,
  fileToDataUrl,
  formatDateTime,
  isAdminAuthError,
  redirectAdminToLogin,
  updateStudent,
  useAdminSessionGuard,
} from "../_lib/admin-portal";

function EditStudentModal({
  student,
  form,
  previewUrl,
  isSaving,
  onClose,
  onFieldChange,
  onImageChange,
  onSubmit,
}) {
  if (!student) {
    return null;
  }

  const currentPhotoUrl = buildAssetUrl(student.face_image_url);
  const visiblePhotoUrl = previewUrl || currentPhotoUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8">
      <Card className="max-h-full w-full max-w-4xl overflow-y-auto rounded-[2rem] border-white/80 bg-white/95 shadow-[0_35px_120px_rgba(15,23,42,0.35)] backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <CardTitle className="text-2xl">{student.full_name}</CardTitle>
            <CardDescription className="mt-1 text-sm">
              Student ID #{student.student_id}. Update details and preview the face image before saving.
            </CardDescription>
          </div>

          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Close
          </Button>
        </CardHeader>

        <CardContent className="grid gap-6 p-6 lg:grid-cols-[0.88fr,1.12fr]">
          <PhotoPreviewCard
            title="Face Preview"
            subtitle="Current student photo or the new uploaded replacement."
            imageUrl={visiblePhotoUrl}
            fallbackLabel="No face image is stored for this student yet."
          />

          <form onSubmit={onSubmit} className="space-y-4">
            <FieldBlock label="Full Name" htmlFor="edit-student-name">
              <Input
                id="edit-student-name"
                type="text"
                value={form.full_name}
                onChange={(event) => onFieldChange("full_name", event.target.value)}
                className={ADMIN_FIELD_CLASSNAME}
              />
            </FieldBlock>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldBlock label="Email" htmlFor="edit-student-email">
                <Input
                  id="edit-student-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => onFieldChange("email", event.target.value)}
                  className={ADMIN_FIELD_CLASSNAME}
                />
              </FieldBlock>

              <FieldBlock label="Phone Number" htmlFor="edit-student-phone-number">
                <Input
                  id="edit-student-phone-number"
                  type="text"
                  inputMode="numeric"
                  value={form.phone_number}
                  onChange={(event) => onFieldChange("phone_number", event.target.value)}
                  className={ADMIN_FIELD_CLASSNAME}
                />
              </FieldBlock>
            </div>

            <FieldBlock label="Grade" htmlFor="edit-student-grade">
              <Input
                id="edit-student-grade"
                type="text"
                value={form.grade}
                onChange={(event) => onFieldChange("grade", event.target.value)}
                className={ADMIN_FIELD_CLASSNAME}
              />
            </FieldBlock>

            <PasswordField
              label="Password"
              value={form.password}
              onChange={(event) => onFieldChange("password", event.target.value)}
              placeholder="Leave blank to keep the existing password"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <FieldBlock
              label="Replace Face Image"
              htmlFor="edit-student-face-image"
              hint="Upload a new image only if you want to update the stored face profile."
            >
              <FileInput
                id="edit-student-face-image"
                accept="image/*"
                onChange={onImageChange}
              />
            </FieldBlock>

            <div className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Student Email
                </p>
                <p className="mt-2 text-sm text-slate-700">{student.email || "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Phone Number
                </p>
                <p className="mt-2 text-sm text-slate-700">{student.phone_number || "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Grade
                </p>
                <p className="mt-2 text-sm text-slate-700">{student.grade || "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Registered
                </p>
                <p className="mt-2 text-sm text-slate-700">{formatDateTime(student.created_at)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? "Saving Changes..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDirectoryPage() {
  const router = useRouter();
  const { sessionReady, adminSession } = useAdminSessionGuard(router);

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [directoryMessage, setDirectoryMessage] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSortField, setStudentSortField] = useState("full_name");
  const [studentSortDirection, setStudentSortDirection] = useState("asc");
  const [editModalStudent, setEditModalStudent] = useState(null);
  const [editStudentForm, setEditStudentForm] = useState(createStudentForm());
  const [editStudentPreviewUrl, setEditStudentPreviewUrl] = useState("");
  const [isSavingEditStudent, setIsSavingEditStudent] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState(null);

  async function refreshStudents() {
    if (!adminSession.token) {
      return;
    }

    setLoadingStudents(true);
    setDirectoryMessage(null);

    try {
      const records = await fetchStudents(adminSession.token);
      setStudents(records);
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not load students.",
      });
    } finally {
      setLoadingStudents(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !adminSession.token) {
      return;
    }

    let isActive = true;

    async function loadInitialStudents() {
      try {
        const records = await fetchStudents(adminSession.token);

        if (!isActive) {
          return;
        }

        setStudents(records);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isAdminAuthError(error)) {
          redirectAdminToLogin(router);
          return;
        }

        setDirectoryMessage({
          type: "error",
          message: error.message || "Could not load students.",
        });
      } finally {
        if (isActive) {
          setLoadingStudents(false);
        }
      }
    }

    loadInitialStudents();

    return () => {
      isActive = false;
    };
  }, [adminSession.token, router, sessionReady]);

  function openEditModal(student) {
    setEditModalStudent(student);
    setEditStudentForm(createStudentForm(student));
    setEditStudentPreviewUrl("");
  }

  function closeEditModal() {
    setEditModalStudent(null);
    setEditStudentForm(createStudentForm());
    setEditStudentPreviewUrl("");
  }

  async function handleEditImageChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setEditStudentForm((current) => ({
      ...current,
      face_image: selectedFile,
    }));

    if (!selectedFile) {
      setEditStudentPreviewUrl("");
      return;
    }

    try {
      setEditStudentPreviewUrl(await fileToDataUrl(selectedFile));
    } catch (error) {
      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not preview the selected image.",
      });
    }
  }

  async function handleEditStudent(event) {
    event.preventDefault();

    if (!editModalStudent) {
      return;
    }

    if (!editStudentForm.full_name.trim()) {
      setDirectoryMessage({ type: "error", message: "Student name is required." });
      return;
    }

    setIsSavingEditStudent(true);
    setDirectoryMessage(null);

    try {
      const response = await updateStudent(
        adminSession.token,
        editModalStudent.student_id,
        editStudentForm,
      );

      await refreshStudents();
      closeEditModal();
      setDirectoryMessage({
        type: "success",
        message: response.message || "Student updated successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not update the student.",
      });
    } finally {
      setIsSavingEditStudent(false);
    }
  }

  async function handleDeleteStudent(student) {
    const confirmed = window.confirm(
      `Delete ${student.full_name}? This will also remove that student's attendance and leave records.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingStudentId(student.student_id);
    setDirectoryMessage(null);

    try {
      const response = await deleteStudentRecord(adminSession.token, student.student_id);

      if (editModalStudent?.student_id === student.student_id) {
        closeEditModal();
      }

      await refreshStudents();
      setDirectoryMessage({
        type: "success",
        message: response.message || "Student deleted successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not delete the student.",
      });
    } finally {
      setDeletingStudentId(null);
    }
  }

  if (!sessionReady || !adminSession.token) {
    return <AdminLoadingScreen />;
  }

  const filteredStudents = students.filter((student) =>
    `${student.student_id} ${student.full_name} ${student.email || ""} ${student.phone_number || ""} ${student.grade || ""}`
      .toLowerCase()
      .includes(studentSearch.toLowerCase()),
  );

  const sortedStudents = [...filteredStudents].sort((leftStudent, rightStudent) => {
    let leftValue = leftStudent[studentSortField];
    let rightValue = rightStudent[studentSortField];

    if (studentSortField === "student_id") {
      leftValue = leftStudent.student_id;
      rightValue = rightStudent.student_id;
    }

    if (studentSortField === "phone_number") {
      leftValue = leftStudent.phone_number;
      rightValue = rightStudent.phone_number;
    }

    if (studentSortField === "grade") {
      leftValue = leftStudent.grade;
      rightValue = rightStudent.grade;
    }

    if (studentSortField === "created_at") {
      leftValue = new Date(leftStudent.created_at).getTime();
      rightValue = new Date(rightStudent.created_at).getTime();
    }

    if (typeof leftValue === "string" || typeof rightValue === "string") {
      leftValue = String(leftValue || "").toLowerCase();
      rightValue = String(rightValue || "").toLowerCase();
    }

    if (leftValue < rightValue) {
      return studentSortDirection === "asc" ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return studentSortDirection === "asc" ? 1 : -1;
    }

    return 0;
  });

  return (
    <>
      <AdminShell
        adminSession={adminSession}
        pageLabel="Student Directory"
        title="Student Directory"
        subtitle="Review registered students, sort the directory, edit account details, and remove records from this dedicated admin page."
      >
        <PageCard>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <SectionIntro
              eyebrow="Directory"
              title="View, sort, edit, and delete students"
              description="Sort the directory in ascending or descending order and open the edit dialog to review each student photo and detail set."
            />

            <div className="grid gap-3 sm:grid-cols-4">
              <Input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                className={ADMIN_FIELD_CLASSNAME}
              />

              <NativeSelect
                value={studentSortField}
                onChange={(event) => setStudentSortField(event.target.value)}
              >
                <option value="full_name">Sort by Name</option>
                <option value="student_id">Sort by ID</option>
                <option value="email">Sort by Email</option>
                <option value="phone_number">Sort by Phone Number</option>
                <option value="grade">Sort by Grade</option>
                <option value="created_at">Sort by Created Date</option>
              </NativeSelect>

              <NativeSelect
                value={studentSortDirection}
                onChange={(event) => setStudentSortDirection(event.target.value)}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </NativeSelect>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-full"
                onClick={refreshStudents}
              >
                <RefreshCcw className={`size-4 ${loadingStudents ? "animate-spin" : ""}`} />
                {loadingStudents ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>

          {directoryMessage ? (
            <MessageBanner type={directoryMessage.type} className="mt-5">
              {directoryMessage.message}
            </MessageBanner>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-600">
            <p>
              Showing <span className="font-semibold text-slate-900">{sortedStudents.length}</span>{" "}
              of <span className="font-semibold text-slate-900">{students.length}</span> students.
            </p>
            <p className="hidden text-right md:block">
              Edit records, replace face images, or remove student accounts directly from the directory.
            </p>
          </div>
        </PageCard>

        <PageCard className="overflow-hidden p-0">
          <Table className="min-w-[70rem]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="px-6">Photo</TableHead>
                <TableHead className="px-6">ID</TableHead>
                <TableHead className="px-6">Name</TableHead>
                <TableHead className="px-6">Email</TableHead>
                <TableHead className="px-6">Phone</TableHead>
                <TableHead className="px-6">Grade</TableHead>
                <TableHead className="px-6">Registered</TableHead>
                <TableHead className="px-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {sortedStudents.length === 0 ? (
                <TableRow>
                  <TableCell className="px-6 py-8 text-slate-500" colSpan="8">
                    No students matched the current search and sort settings.
                  </TableCell>
                </TableRow>
              ) : (
                sortedStudents.map((student) => {
                  const photoUrl = buildAssetUrl(student.face_image_url);

                  return (
                    <TableRow key={student.student_id}>
                      <TableCell className="px-6">
                        <PhotoThumb
                          imageUrl={photoUrl}
                          alt={`${student.full_name} face preview`}
                        />
                      </TableCell>
                      <TableCell className="px-6 font-medium">{student.student_id}</TableCell>
                      <TableCell className="px-6">{student.full_name}</TableCell>
                      <TableCell className="px-6">{student.email || "-"}</TableCell>
                      <TableCell className="px-6">{student.phone_number || "-"}</TableCell>
                      <TableCell className="px-6">{student.grade || "-"}</TableCell>
                      <TableCell className="px-6">{formatDateTime(student.created_at)}</TableCell>
                      <TableCell className="px-6">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => openEditModal(student)}
                          >
                            <PencilLine className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => handleDeleteStudent(student)}
                            disabled={deletingStudentId === student.student_id}
                          >
                            <Trash2 className="size-4" />
                            {deletingStudentId === student.student_id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </PageCard>
      </AdminShell>

      <EditStudentModal
        student={editModalStudent}
        form={editStudentForm}
        previewUrl={editStudentPreviewUrl}
        isSaving={isSavingEditStudent}
        onClose={closeEditModal}
        onFieldChange={(field, value) =>
          setEditStudentForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onImageChange={handleEditImageChange}
        onSubmit={handleEditStudent}
      />
    </>
  );
}
