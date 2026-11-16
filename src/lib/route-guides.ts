export interface RouteGuideStep {
  title: string;
  detail: string;
}

export interface RouteGuideConfig {
  href: string;
  shortNavLabel: string;
  title: string;
  shortDesc: string;
  steps: RouteGuideStep[];
  tip: string;
  villageHeadHidden?: boolean;
}

export const ROUTE_GUIDES: RouteGuideConfig[] = [
  {
    href: "/dashboard",
    shortNavLabel: "Tổng quan",
    title: "Tổng quan hệ thống",
    shortDesc: "Theo dõi nhanh toàn bộ số liệu an sinh của Xã Bình An và sao lưu dữ liệu.",
    steps: [
      {
        title: "Xem các thẻ số liệu tổng hợp",
        detail:
          "Kiểm tra tổng hồ sơ đang hoạt động, hồ sơ 'Chờ rà soát lại' (thiếu năm sinh/hết hạn tạm thời), tổng suất quà đã trao trong năm và việc đang chờ xử lý.",
      },
      {
        title: "Theo dõi biểu đồ 10 Thôn & Nhóm đối tượng",
        detail:
          "Đối chiếu nhanh quân số theo từng thôn (Phú Lạc, Kiên Long, Kiên Ngãi, Trường Định, Vĩnh Lộc, An Chánh, Mỹ An, Mỹ Thuận, An Vinh, Bỉnh Đức) và từng nhóm NĐ 176 / NĐ 20 / NĐ 335.",
      },
      {
        title: "Sao lưu toàn bộ dữ liệu định kỳ",
        detail:
          "Bấm 'Sao lưu Excel lên Drive' để lưu ngay 1 bản dự phòng vào thư mục AN_SINH_XA_BA/04_SaoLuu_HeThong trên Google Drive (hoặc tải thẳng về máy).",
      },
    ],
    tip: "Nếu có hồ sơ 'Chờ rà soát lại', bấm thẳng vào thẻ đó để chuyển sang danh sách lọc riêng các trường hợp cần bổ sung.",
  },
  {
    href: "/citizens",
    shortNavLabel: "Đối tượng",
    title: "Danh sách Đối tượng an sinh",
    shortDesc: "Kéo-thả danh sách Phòng VH-XH, tự động gán điểm Lãnh đạo, lọc & xuất Excel báo cáo.",
    steps: [
      {
        title: "Nhập nhanh từ Excel (kéo-thả)",
        detail:
          "Kéo thả trực tiếp file danh sách 4 sheet của Phòng VH-XH (NĐ 176 Hưu trí / NĐ 20 Bảo trợ) hoặc Mẫu chuẩn vào khung nét đứt → kiểm tra bảng Xem trước → bấm 'Xác nhận nhập'.",
      },
      {
        title: "Xem điểm tự động & bổ sung hộ phát sinh",
        detail:
          "Điểm ưu tiên tự động tính từ Bảng điểm Lãnh đạo (cộng dồn nếu thuộc nhiều nhóm). Với hộ thiên tai/hỏa hoạn mới phát sinh, bấm '+ Thêm đối tượng'.",
      },
      {
        title: "Lọc nhanh & Xuất Excel theo đúng bộ lọc",
        detail:
          "Lọc theo Tên/Mã, Thôn, Nhóm đối tượng hoặc Trạng thái (kể cả 'Đã giảm / Tạm dừng'), rồi bấm nút xanh 'Xuất Excel đang lọc' để tải file 2 sheet (Thống kê tổng hợp + Danh sách chi tiết).",
      },
    ],
    tip: "Kéo lần lượt nhiều file sẽ nhập nối tiếp, KHÔNG bị ghi đè mất dữ liệu cũ; người trùng giữa 2 danh sách sẽ tự gộp thêm nhóm.",
  },
  {
    href: "/programs",
    shortNavLabel: "Đợt hỗ trợ",
    title: "Đợt hỗ trợ & Lọc danh sách nhận quà",
    shortDesc: "Lập đợt trao quà, chấm điểm ưu tiên 3 lớp, chống trùng cùng dịp và xuất bảng ký nhận.",
    villageHeadHidden: true,
    steps: [
      {
        title: "Tạo đợt hỗ trợ mới",
        detail:
          "Bấm '+ Tạo đợt hỗ trợ mới', nhập Tên đợt, Dịp (vd: TET_2026), Nhà tài trợ, Số suất dự kiến và lọc theo Nhóm/Thôn nếu tài trợ có điều kiện riêng.",
      },
      {
        title: "Chạy lọc ưu tiên & xử lý cảnh báo trùng",
        detail:
          "Hệ thống tự xếp hạng từ cao xuống thấp theo Bảng điểm, trừ điểm người mới nhận gần đây và đẩy người đã nhận cùng dịp sang mục 'Dự phòng nhận lần 2' (có nút duyệt ngoại lệ cho Lãnh đạo).",
      },
      {
        title: "Trình duyệt → Khóa → Chấm đã phát → Xuất bảng ký nhận",
        detail:
          "Sau khi Lãnh đạo phê duyệt & khóa danh sách, tích xác nhận khi trao quà thực tế và bấm 'Xuất bảng ký nhận (6 cột)' để in ký tay.",
      },
    ],
    tip: "Dùng nút 'Chạy lại lọc' bất kỳ lúc nào trước khi Khóa đợt nếu Bảng điểm hoặc danh sách đối tượng vừa cập nhật.",
  },
  {
    href: "/reports",
    shortNavLabel: "Báo cáo",
    title: "Báo cáo tổng hợp & Đề xuất đợt kế tiếp",
    shortDesc: "Thống kê tiền/quà đã trao theo thời gian, thôn, nguồn tài trợ và đề xuất danh sách tiếp theo.",
    villageHeadHidden: true,
    steps: [
      {
        title: "Chọn khoảng thời gian / Thôn / Hình thức hỗ trợ",
        detail:
          "Lọc đúng kỳ báo cáo tháng/quý/năm hoặc từng thôn để xem tổng số lượt trao, số người thực nhận và tổng giá trị (VNĐ).",
      },
      {
        title: "Xem danh sách đề xuất cho đợt sắp tới",
        detail:
          "Điều chỉnh số suất muốn đề xuất để xem trước những hoàn cảnh điểm ưu tiên cao nhất mà lâu chưa nhận hỗ trợ.",
      },
      {
        title: "Xuất Excel báo cáo UBND",
        detail:
          "Bấm 'Xuất Excel báo cáo' để tải file hoàn chỉnh gồm Tổng hợp theo Thôn, Chi tiết cấp phát và Danh sách đề xuất đợt tiếp theo.",
      },
    ],
    tip: "Số liệu chỉ tính từ các suất đã đánh dấu 'Đã trao' thực tế trong các Đợt hỗ trợ.",
  },
  {
    href: "/tasks",
    shortNavLabel: "Giao việc",
    title: "Giao nhiệm vụ & Theo dõi xác minh",
    shortDesc: "Phân công rà soát 6 tháng, xác minh hộ thiệt hại hoặc gia hạn hồ sơ tạm thời.",
    steps: [
      {
        title: "Giao việc mới (Lãnh đạo / Cấp phòng)",
        detail:
          "Bấm '+ Giao nhiệm vụ', chọn loại việc, thôn liên quan, cán bộ/trưởng thôn thực hiện và hạn hoàn thành.",
      },
      {
        title: "Thực hiện & báo cáo kết quả (Trưởng thôn / Cán bộ)",
        detail:
          "Người được giao bấm cập nhật trạng thái 'Đang làm' → 'Gửi kiểm tra' kèm ghi chú kết quả xác minh.",
      },
      {
        title: "Nghiệm thu hoàn thành",
        detail:
          "Cấp giao việc kiểm tra kết quả, bấm 'Hoàn thành' hoặc 'Yêu cầu làm lại' nếu cần bổ sung.",
      },
    ],
    tip: "Trưởng thôn đăng nhập sẽ chỉ thấy các nhiệm vụ thuộc thôn mình phụ trách để thao tác gọn nhất.",
  },
  {
    href: "/audit",
    shortNavLabel: "Nhật ký",
    title: "Nhật ký hệ thống & Biến động",
    shortDesc: "Tra cứu vết kiểm toán không thể sửa/xóa phục vụ công tác kiểm tra, minh bạch.",
    villageHeadHidden: true,
    steps: [
      {
        title: "Theo dõi mọi tác vụ trọng yếu",
        detail:
          "Mọi hành động thêm/sửa hồ sơ, Import Excel, đổi Bảng điểm Lãnh đạo, Khóa/Duyệt chương trình hay Chuyển quyền Quản lý đều được ghi lại theo thời gian thực.",
      },
      {
        title: "Đối chiếu người thực hiện",
        detail:
          "Xem chính xác tài khoản nào thao tác lúc mấy giờ, giá trị cũ và giá trị mới thay đổi ra sao.",
      },
    ],
    tip: "Nhật ký được bảo vệ chỉ đọc để phục vụ thanh tra, kiểm toán nội bộ.",
  },
  {
    href: "/admin",
    shortNavLabel: "Quản trị",
    title: "Quản trị Hệ thống, Bảng điểm & Google Drive",
    shortDesc: "Quản lý tài khoản nhân sự, kết nối Drive lưu trữ, chỉnh Bảng điểm Lãnh đạo và 10 Thôn.",
    villageHeadHidden: true,
    steps: [
      {
        title: "Tab 'Nhân sự & Phân quyền'",
        detail:
          "Tạo tài khoản cho Lãnh đạo cấp phòng, Cán bộ chuyên môn và Trưởng từng thôn (10 thôn); mật khẩu tạm mặc định bắt buộc đổi khi đăng nhập lần đầu.",
      },
      {
        title: "Tab 'Kết nối Google Drive & Sao lưu'",
        detail:
          "Chỉ Chủ quản (OWNER) kết nối 1 lần duy nhất để cả xã dùng chung kho AN_SINH_XA_BA trên Drive; bấm 'Sao lưu toàn bộ CSDL ngay' khi cần.",
      },
      {
        title: "Tab 'Thôn & Quy tắc Chấm điểm'",
        detail:
          "Quản lý 10 thôn chuẩn của Xã Bình An, sửa điểm từng nhóm trực tiếp hoặc dùng 'Tải Excel Bảng điểm' → sửa → 'Nhập riêng Bảng điểm (.xlsx)' để áp điểm tự động.",
      },
    ],
    tip: "Khi bàn giao công tác cho Lãnh đạo mới, dùng tab 'Chuyển quyền Quản lý' để chuyển vai trò OWNER an toàn mà vẫn giữ nguyên toàn bộ dữ liệu.",
  },
];

export function getRouteGuide(pathname: string): RouteGuideConfig {
  const match = ROUTE_GUIDES.find((g) => pathname.startsWith(g.href));
  return match ?? ROUTE_GUIDES[0];
}
