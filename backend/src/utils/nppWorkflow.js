const SENIOR_ROLES = new Set([
  "Admin",
  "Manager",
  "VP",
  "GM",
  "MD",
  "Director",
  "AGM",
  "Approver",
]);

function normalizeStakeholders(stakeholders = []) {
  return stakeholders
    .map((s, index) => ({
      name: s.name,
      email: String(s.email || "").toLowerCase(),
      designation: s.designation || "",
      line: s.line || "Sequential",
      status: "Pending",
      remarks: "",
      dateTime: null,
      approvalOrder: Number(s.approvalOrder || index + 1),
    }))
    .sort((a, b) => a.approvalOrder - b.approvalOrder);
}

function getCurrentPendingStakeholder(doc) {
  const list = (doc.stakeholders || [])
    .filter((s) => s.status === "Pending" || s.status === "In-Process")
    .sort((a, b) => (a.approvalOrder || 0) - (b.approvalOrder || 0));
  return list[0] || null;
}

function canUserAct(user, doc) {
  if (!user || !doc) return false;
  if (user.rights?.nppProcurement || user.rights?.epApproval) return true;
  if (SENIOR_ROLES.has(user.role)) return true;
  const current = getCurrentPendingStakeholder(doc);
  return !!current && String(current.email || "").toLowerCase() === String(user.email || "").toLowerCase();
}

function applyStakeholderAction(doc, user, action, comments = "") {
  const current = getCurrentPendingStakeholder(doc);
  if (!current) return { ok: false, message: "No pending approver found" };

  const actorLabel = user?.name || user?.email || "Approver";
  current.status = action;
  current.remarks = comments || action;
  current.dateTime = new Date();

  if (action === "Rejected") {
    doc.status = "Rejected";
    return { ok: true, final: true, actorLabel };
  }

  const nextPending = getCurrentPendingStakeholder(doc);
  if (!nextPending) {
    doc.status = "Approved";
    return { ok: true, final: true, actorLabel };
  }

  doc.status = "In-Process";
  return { ok: true, final: false, actorLabel, nextApprover: nextPending };
}

module.exports = {
  normalizeStakeholders,
  getCurrentPendingStakeholder,
  canUserAct,
  applyStakeholderAction,
};
