import { ProvisionalMark } from "@/components/ProvisionalMark";
import { formatValue } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";

export function IrFigure({
  value,
  provisional = false,
  unit = false,
}: {
  value: number;
  provisional?: boolean;
  unit?: boolean;
}) {
  return (
    <>
      {formatValue("ir", value)}
      {provisional ? <ProvisionalMark /> : null}
      {unit ? ` ${IR_UNIT}` : null}
    </>
  );
}
