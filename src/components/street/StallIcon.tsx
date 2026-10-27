import type { StallKind } from "@/lib/domain";
import { stallIconSvg } from "@/components/street/stallIcons";

/** 제보 종류 아이콘. 고정 SVG 문자열이라 그대로 넣는다 */
export function StallIcon({ kind, size = 24, className = "" }: { kind: StallKind; size?: number; className?: string }) {
  return <span className={`inline-block shrink-0 leading-none ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: stallIconSvg(kind, size) }} />;
}
