export const ROLES = {
  OWNER: "OWNER",
  LEADER: "LEADER",
  DEPT_HEAD: "DEPT_HEAD",
  STAFF: "STAFF",
  VILLAGE_HEAD: "VILLAGE_HEAD",
  AUDITOR: "AUDITOR",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Chủ quản hệ thống (Lãnh đạo)",
  LEADER: "Lãnh đạo UBND / MTTQ",
  DEPT_HEAD: "Lãnh đạo cấp phòng (VHXH)",
  STAFF: "Cán bộ chuyên môn / Hội đoàn",
  VILLAGE_HEAD: "Trưởng thôn",
  AUDITOR: "Giám sát / Kiểm tra",
};

export const CITIZEN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  TEMPORARY: "Khó khăn tạm thời",
  PENDING_REVIEW: "Chờ rà soát lại",
  ENDED: "Đã kết thúc",
  MOVED_OUT: "Chuyển địa bàn",
  DECEASED: "Đã mất",
};

export const PROGRAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ cấp phòng kiểm tra",
  LOCKED: "Đã khóa (Trình phê duyệt)",
  APPROVED: "Đã phê duyệt",
  REOPENED: "Mở lại theo quyết định",
};

export const SUPPORT_TIER_LABELS: Record<string, string> = {
  SMALL: "Hỗ trợ nhỏ",
  MEDIUM: "Hỗ trợ trung bình",
  LARGE: "Hỗ trợ lớn",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  NEW: "Mới giao",
  IN_PROGRESS: "Đang thực hiện",
  SUBMITTED: "Chờ kiểm tra",
  DONE: "Hoàn thành",
  RETURNED: "Yêu cầu làm lại",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  REVIEW_6_MONTHS: "Rà soát định kỳ 6 tháng",
  VERIFY_DISASTER: "Xác minh thiệt hại thiên tai / sự cố",
  UPDATE_EXPIRED_TEMP: "Rà soát hồ sơ tạm thời hết hạn",
  PREPARE_PROGRAM: "Chuẩn bị danh sách đợt hỗ trợ",
  OTHER: "Nhiệm vụ khác",
};

export const DEFAULT_SUPPORT_GROUPS = [
  { code: "NCC", name: "Người có công với cách mạng", baseScore: 10, sortOrder: 1, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "TNLS", name: "Thân nhân liệt sĩ", baseScore: 9, sortOrder: 2, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "HO_NGHEO", name: "Hộ nghèo", baseScore: 10, sortOrder: 3, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "CAN_NGHEO", name: "Hộ cận nghèo", baseScore: 6, sortOrder: 4, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "KT_DBN", name: "Người khuyết tật đặc biệt nặng", baseScore: 10, sortOrder: 5, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "KT_NANG", name: "Người khuyết tật nặng", baseScore: 8, sortOrder: 6, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "BENH_HN", name: "Người mắc bệnh hiểm nghèo", baseScore: 9, sortOrder: 7, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "TRE_MO_COI", name: "Trẻ em mồ côi / hoàn cảnh đặc biệt", baseScore: 10, sortOrder: 8, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "GIA_NEO_DON", name: "Người cao tuổi neo đơn", baseScore: 8, sortOrder: 9, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "THIEN_TAI", name: "Hộ thiệt hại do thiên tai", baseScore: 7, sortOrder: 10, isPhase2Optional: false, isTemporaryDefault: true, defaultDurationMonths: 6 },
  { code: "HOA_HOAN", name: "Hộ thiệt hại do hỏa hoạn", baseScore: 9, sortOrder: 11, isPhase2Optional: false, isTemporaryDefault: true, defaultDurationMonths: 12 },
  { code: "DICH_BENH", name: "Hộ thiệt hại do dịch bệnh", baseScore: 7, sortOrder: 12, isPhase2Optional: false, isTemporaryDefault: true, defaultDurationMonths: 6 },
  { code: "TNLD", name: "Người bị tai nạn lao động", baseScore: 7, sortOrder: 13, isPhase2Optional: false, isTemporaryDefault: true, defaultDurationMonths: 6 },
  { code: "BENH_NN", name: "Người mắc bệnh nghề nghiệp", baseScore: 6, sortOrder: 14, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "BTXH", name: "Đối tượng bảo trợ xã hội khác", baseScore: 6, sortOrder: 15, isPhase2Optional: false, isTemporaryDefault: false, defaultDurationMonths: null },
  // Nhóm bổ sung giai đoạn sau (theo Link 2)
  { code: "THAT_NGHIEP", name: "Người thất nghiệp dài hạn", baseScore: 4, sortOrder: 16, isPhase2Optional: true, isTemporaryDefault: true, defaultDurationMonths: 6 },
  { code: "PN_DON_THAN", name: "Phụ nữ đơn thân nuôi con nhỏ", baseScore: 5, sortOrder: 17, isPhase2Optional: true, isTemporaryDefault: false, defaultDurationMonths: null },
  { code: "NGUY_CO_BO_HOC", name: "Trẻ em có nguy cơ bỏ học", baseScore: 6, sortOrder: 18, isPhase2Optional: true, isTemporaryDefault: false, defaultDurationMonths: null },
];

export const DEFAULT_VILLAGES = Array.from({ length: 17 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  return {
    code: `T${num}`,
    name: `Thôn ${i + 1}`,
    sortOrder: i + 1,
    isActive: true,
  };
});
