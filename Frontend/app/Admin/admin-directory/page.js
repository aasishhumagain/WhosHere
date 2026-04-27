"use client";

import { RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PasswordField from "@/app/_components/PasswordField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  changeAdminPassword,
  createAdminPasswordForm,
  createAdminUser,
  createAdminUserForm,
  deleteAdminUser,
  fetchAdminUsers,
  formatDateTime,
  isAdminAuthError,
  redirectAdminToLogin,
  useAdminSessionGuard,
} from "../_lib/admin-portal";

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
      `Delete the admin account "${adminUser.username}"? This admin will lose access to the admin workspace.`,
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
      subtitle="Manage admin accounts from a separate page, create additional admins, update the current admin password, and keep admin deletion restricted to the main admin account."
    >
      <PageCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionIntro
            eyebrow="Admin Accounts"
            title="Directory and security for admin users"
            description="This page is dedicated to admin account management. Use it to review who can access the admin workspace, create another admin account, update your own password, and let only the main admin remove other admins."
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
          account itself is protected from deletion.
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
                    ) : adminUser.username === "admin" ? (
                      <span className="text-sm text-slate-500">Primary admin is protected</span>
                    ) : (
                      <span className="text-sm text-slate-500">Only admin can delete</span>
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
            description="Create a new admin login so another trusted user can access the admin workspace with their own credentials."
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
            description="Update the password for the currently signed-in admin account directly from this page."
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
    </AdminShell>
  );
}
