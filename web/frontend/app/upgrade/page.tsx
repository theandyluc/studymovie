import { Card } from "@/components/ui/Card";

// WEB-08 placeholder — trang nâng cấp thật (VietQR + SePay) làm ở TIP-011.
// Hiện chỉ là chỗ để nút "Nâng cấp" (extension/web) trỏ về.
export default function UpgradePage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <h1 className="font-heading text-xl font-bold">Nâng cấp StudyMovie</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Trang thanh toán (VietQR) đang được phát triển. Sẽ sớm có ở bản cập nhật tới.
        </p>
      </Card>
    </div>
  );
}
