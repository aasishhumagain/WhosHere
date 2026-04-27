"use client";

import { PencilLine, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PasswordField from "@/app/_components/PasswordField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  MessageBanner,
  PageCard,
  SectionIntro,
  StatCard,
} from "../_components/AdminUI";
import {
  createAdminEditForm,
  changeAdminPassword,
  createAdminPasswordForm,
  createAdminUser,
  createAdminUserForm,
  deleteAdminUser,
  fetchAdminUsers,
  formatDateTime,
  isAdminAuthError,
  redirectAdminToLogin,
  updateAdminUser,
  useAdminSessionGuard,
} from "../_lib/admin-portal";

function EditAdminModal({
  adminUser,
  form,
  isSaving,
  onClose,
  onFieldChange,
  onSubmit,
}) {
  if (!adminUser) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8">
      <Card className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[2rem] border-white/80 bg-white/95 shadow-[0_35px_120px_rgba(15,23,42,0.35)] backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <CardTitle className="text-2xl">Edit {adminUser.username}</CardTitle>
            <CardDescription className="mt-1 text-sm">
              Update this admin account&apos;s username or set a new password.
            </CardDescription>
          </div>

          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Close
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <FieldBlock label="Username" htmlFor="edit-admin-username">
              <Input
                id="edit-admin-username"
                type="text"
                value={form.username}
                onChange={(event) => onFieldChange("username", event.target.value)}
                className={ADMIN_FIELD_CLASSNAME}
              />
            </FieldBlock>

            <PasswordField
              label="New Password"
              value={form.password}
              onChange={(event) => onFieldChange("password", event.target.value)}
              placeholder="Leave blank to keep the existing password"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <PasswordField
              label="Confirm New Password"
              value={form.confirm_password}
              onChange={(event) => onFieldChange("confirm_password", event.target.value)}
              placeholder="Repeat the new password if you are changing it"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <div className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Current Username
                </p>
                <p className="mt-2 text-sm text-slate-700">{adminUser.username}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Created
                </p>
                <p className="mt-2 text-sm text-slate-700">{formatDateTime(adminUser.created_at)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? "Saving Changes..." : "Save Admin Changes"}
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

  const [adminUsers, setAdminUsers] = useState([]);
  const [currentAdminId, setCurrentAdminId] = useState(null);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [directoryMessage, setDirectoryMessage] = useState(null);
  const [adminUserForm, setAdminUserForm] = useState(createAdminUserForm());
  const [adminPasswordForm, setAdminPasswordForm] = useState(createAdminPasswordForm());
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editAdminUser, setEditAdminUser] = useState(null);
  const [editAdminForm, setEditAdminForm] = useState(createAdminEditForm());
  const [savingEditAdmin, setSavingEditAdmin] = useState(false);
  const [deletingAdminId, setDeletingAdminId] = useState(null);

  async function refreshAdminUsers() {
    if (!adminSession.token) {
      return;
    }

    setLoadingAdmins(true);
    setDirectoryMessage(null);

    try {
      const data = await fetchAdminUsers(adminSession.token);
      setAdminUsers(data.admins || []);
      setCurrentAdminId(data.current_admin_id ?? null);
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not load admin accounts.",
      });
    } finally {
      setLoadingAdmins(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !adminSession.token) {
      return;
    }

    let isActive = true;

    async function loadInitialAdminUsers() {
      try {
        const data = await fetchAdminUsers(adminSession.token);

        if (!isActive) {
          return;
        }

        setAdminUsers(data.admins || []);
        setCurrentAdminId(data.current_admin_id ?? null);
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
          message: error.message || "Could not load admin accounts.",
        });
      } finally {
        if (isActive) {
          setLoadingAdmins(false);
        }
      }
    }

    loadInitialAdminUsers();

    return () => {
      isActive = false;
    };
  }, [adminSession.token, router, sessionReady]);

  async function handleCreateAdmin(event) {
    event.preventDefault();

    if (!adminUserForm.username.trim()) {
      setDirectoryMessage({
        type: "error",
        message: "Admin username is required.",
      });
      return;
    }

    if (!adminUserForm.password.trim() || !adminUserForm.confirm_password.trim()) {
      setDirectoryMessage({
        type: "error",
        message: "Password and confirmation are required for a new admin account.",
      });
      return;
    }

    if (adminUserForm.password !== adminUserForm.confirm_password) {
      setDirectoryMessage({
        type: "error",
        message: "New admin password and confirmation do not match.",
      });
      return;
    }

    setCreatingAdmin(true);
    setDirectoryMessage(null);

    try {
      const response = await createAdminUser(adminSession.token, adminUserForm);
      setAdminUserForm(createAdminUserForm());
      await refreshAdminUsers();
      setDirectoryMessage({
        type: "success",
        message: response.message || "Admin account created successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not create the admin account.",
      });
    } finally {
      setCreatingAdmin(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    if (
      !adminPasswordForm.current_password.trim() ||
      !adminPasswordForm.new_password.trim() ||
      !adminPasswordForm.confirm_password.trim()
    ) {
      setDirectoryMessage({
        type: "error",
        message: "Current password, new password, and confirmation are all required.",
      });
      return;
    }

    if (adminPasswordForm.new_password !== adminPasswordForm.confirm_password) {
      setDirectoryMessage({
        type: "error",
        message: "New password and confirmation do not match.",
      });
      return;
    }

    setChangingPassword(true);
    setDirectoryMessage(null);

    try {
      const response = await changeAdminPassword(
        adminSession.token,
        adminPasswordForm.current_password,
        adminPasswordForm.new_password,
      );
      setAdminPasswordForm(createAdminPasswordForm());
      setDirectoryMessage({
        type: "success",
        message: response.message || "Admin password changed successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not change the admin password.",
      });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAdmin(adminUser) {
    if (adminSession.username !== "admin") {
      setDirectoryMessage({
        type: "error",
        message: "Only the admin account can delete other admin accounts.",
      });
      return;
    }

    if (adminUser.username === "admin") {
      setDirectoryMessage({
        type: "error",
        message: "The admin account cannot be deleted.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete the admin account "${adminUser.username}"? This user will lose admin access.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingAdminId(adminUser.id);
    setDirectoryMessage(null);

    try {
      const response = await deleteAdminUser(adminSession.token, adminUser.id);
      await refreshAdminUsers();
      setDirectoryMessage({
        type: "success",
        message: response.message || "Admin account deleted successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not delete the admin account.",
      });
    } finally {
      setDeletingAdminId(null);
    }
  }

  function openEditAdmin(adminUser) {
    setEditAdminUser(adminUser);
    setEditAdminForm(createAdminEditForm(adminUser));
  }

  function closeEditAdmin(force = false) {
    if (savingEditAdmin && !force) {
      return;
    }

    setEditAdminUser(null);
    setEditAdminForm(createAdminEditForm());
  }

  function handleEditAdminFieldChange(field, value) {
    setEditAdminForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleUpdateAdmin(event) {
    event.preventDefault();

    if (!editAdminUser) {
      return;
    }

    if (adminSession.username !== "admin") {
      setDirectoryMessage({
        type: "error",
        message: "Only the admin account can edit other admin accounts.",
      });
      return;
    }

    if (!editAdminForm.username.trim()) {
      setDirectoryMessage({
        type: "error",
        message: "Admin username is required.",
      });
      return;
    }

    if (editAdminForm.password || editAdminForm.confirm_password) {
      if (!editAdminForm.password.trim() || !editAdminForm.confirm_password.trim()) {
        setDirectoryMessage({
          type: "error",
          message: "Enter and confirm the new password, or leave both password fields blank.",
        });
        return;
      }

      if (editAdminForm.password !== editAdminForm.confirm_password) {
        setDirectoryMessage({
          type: "error",
          message: "New password and confirmation do not match.",
        });
        return;
      }
    }

    setSavingEditAdmin(true);
    setDirectoryMessage(null);

    try {
      const response = await updateAdminUser(
        adminSession.token,
        editAdminUser.id,
        editAdminForm,
      );
      await refreshAdminUsers();
      closeEditAdmin(true);
      setDirectoryMessage({
        type: "success",
        message: response.message || "Admin account updated successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDirectoryMessage({
        type: "error",
        message: error.message || "Could not update the admin account.",
      });
    } finally {
      setSavingEditAdmin(false);
    }
  }

  if (!sessionReady || !adminSession.token) {
    return <AdminLoadingScreen title="Loading admin directory..." description="Preparing admin accounts and security settings." />;
  }

  const currentAdmin = adminUsers.find((adminUser) => adminUser.id === currentAdminId) || null;
  const canDeleteAdmins = adminSession.username === "admin";

  return (
    <AdminShell
      adminSession={adminSession}
      pageLabel="Admin Directory"
      title="Admin Directory"
      subtitle="Manage admin accounts, change passwords, and control who can access the admin side."
    >
      <PageCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionIntro
            eyebrow="Admin Accounts"
            title="Directory and security for admin users"
            description="Use this page to see which admin accounts exist, add another admin, or update account passwords."
          />

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-full"
            onClick={refreshAdminUsers}
          >
            <RefreshCcw className={`size-4 ${loadingAdmins ? "animate-spin" : ""}`} />
            {loadingAdmins ? "Refreshing..." : "Refresh Directory"}
          </Button>
        </div>

        {directoryMessage ? (
          <MessageBanner type={directoryMessage.type} className="mt-5">
            {directoryMessage.message}
          </MessageBanner>
        ) : null}

        <MessageBanner type="info" className="mt-5">
          Only the username <strong>admin</strong> can delete other admin accounts, and the
          <strong> admin </strong>
          account itself is protected from deletion. The same protected admin can also edit other
          admin usernames and passwords from this page.
        </MessageBanner>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Admin accounts"
            value={loadingAdmins && adminUsers.length === 0 ? "..." : adminUsers.length}
          />
          <StatCard
            label="Current admin"
            value={currentAdmin?.username || adminSession.username}
            accentClass="border-emerald-200/80 bg-emerald-50/80 text-slate-900"
          />
          <StatCard
            label="Security mode"
            value="DB-backed"
            helper="Admin login is now checked against the admin_users table."
            accentClass="border-sky-200/80 bg-sky-50/80 text-slate-900"
          />
        </div>
      </PageCard>

      <PageCard className="overflow-hidden p-0">
        <Table className="min-w-[52rem]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="px-6">Username</TableHead>
              <TableHead className="px-6">Created</TableHead>
              <TableHead className="px-6">Status</TableHead>
              <TableHead className="px-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {adminUsers.length === 0 ? (
              <TableRow>
                <TableCell className="px-6 py-8 text-slate-500" colSpan="4">
                  No admin accounts were found.
                </TableCell>
              </TableRow>
            ) : (
              adminUsers.map((adminUser) => (
                <TableRow key={adminUser.id}>
                  <TableCell className="px-6 font-medium">{adminUser.username}</TableCell>
                  <TableCell className="px-6">{formatDateTime(adminUser.created_at)}</TableCell>
                  <TableCell className="px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {adminUser.id === currentAdminId ? (
                        <Badge className="rounded-full border-0 bg-emerald-100 px-3 py-1 text-emerald-700">
                          Current Session
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          Active Admin
                        </Badge>
                      )}
                      {adminUser.username === "admin" ? (
                        <Badge className="rounded-full border-0 bg-slate-900 px-3 py-1 text-white">
                          Protected
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    {canDeleteAdmins && adminUser.username !== "admin" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={savingEditAdmin && editAdminUser?.id === adminUser.id}
                          onClick={() => openEditAdmin(adminUser)}
                        >
                          <PencilLine className="size-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={deletingAdminId === adminUser.id}
                          onClick={() => handleDeleteAdmin(adminUser)}
                        >
                          <Trash2 className="size-4" />
                          {deletingAdminId === adminUser.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    ) : adminUser.username === "admin" ? (
                      <span className="text-sm text-slate-500">Primary admin is protected</span>
                    ) : (
                      <span className="text-sm text-slate-500">Only admin can edit or delete</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </PageCard>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <PageCard>
          <SectionIntro
            eyebrow="Create Admin"
            title="Add another admin account"
            description="Create a separate login if another trusted person needs admin access."
          />

          <form onSubmit={handleCreateAdmin} className="mt-6 space-y-4">
            <FieldBlock label="Username" htmlFor="new-admin-username">
              <input
                id="new-admin-username"
                type="text"
                value={adminUserForm.username}
                onChange={(event) =>
                  setAdminUserForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="Enter a new admin username"
                className={`w-full ${ADMIN_FIELD_CLASSNAME}`}
              />
            </FieldBlock>

            <PasswordField
              label="Password"
              value={adminUserForm.password}
              onChange={(event) =>
                setAdminUserForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Create a strong password"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <PasswordField
              label="Confirm Password"
              value={adminUserForm.confirm_password}
              onChange={(event) =>
                setAdminUserForm((current) => ({
                  ...current,
                  confirm_password: event.target.value,
                }))
              }
              placeholder="Repeat the new password"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                disabled={creatingAdmin}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              >
                {creatingAdmin ? "Creating..." : "Create Admin Account"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setAdminUserForm(createAdminUserForm())}
              >
                Clear Form
              </Button>
            </div>
          </form>
        </PageCard>

        <PageCard>
          <SectionIntro
            eyebrow="Password Settings"
            title="Change your own admin password"
            description="Update the password for the admin account you are using now."
          />

          <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
            <PasswordField
              label="Current Password"
              value={adminPasswordForm.current_password}
              onChange={(event) =>
                setAdminPasswordForm((current) => ({
                  ...current,
                  current_password: event.target.value,
                }))
              }
              placeholder="Enter your current admin password"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <PasswordField
              label="New Password"
              value={adminPasswordForm.new_password}
              onChange={(event) =>
                setAdminPasswordForm((current) => ({
                  ...current,
                  new_password: event.target.value,
                }))
              }
              placeholder="Enter a new admin password"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <PasswordField
              label="Confirm New Password"
              value={adminPasswordForm.confirm_password}
              onChange={(event) =>
                setAdminPasswordForm((current) => ({
                  ...current,
                  confirm_password: event.target.value,
                }))
              }
              placeholder="Repeat the new password"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={changingPassword} className="rounded-full">
                <ShieldCheck className="size-4" />
                {changingPassword ? "Updating..." : "Change Admin Password"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setAdminPasswordForm(createAdminPasswordForm())}
              >
                Clear Form
              </Button>
            </div>
          </form>
        </PageCard>
      </div>

      <EditAdminModal
        adminUser={editAdminUser}
        form={editAdminForm}
        isSaving={savingEditAdmin}
        onClose={closeEditAdmin}
        onFieldChange={handleEditAdminFieldChange}
        onSubmit={handleUpdateAdmin}
      />
    </AdminShell>
  );
}
