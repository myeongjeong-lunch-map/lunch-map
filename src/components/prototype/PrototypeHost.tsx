"use client";

// PROTOTYPE (throwaway): "지도 화면이 어떻게 생기면 덜 밋밋할까?"
// 네 가지 시안을 `/` 에서 ?variant=A|B|C|D 로 바꿔 본다. A는 지금 화면 그대로.
import { useSearchParams } from "next/navigation";
import { LunchMap } from "../LunchMap";
import { PrototypeSwitcher, type VariantMeta } from "./PrototypeSwitcher";
import { VariantB, name as nameB } from "./VariantB";
import { VariantC, name as nameC } from "./VariantC";
import { VariantD, name as nameD } from "./VariantD";
import { VariantE, name as nameE } from "./VariantE";

const VARIANTS: VariantMeta[] = [
  { key: "A", name: "현재" },
  { key: "B", name: nameB },
  { key: "C", name: nameC },
  { key: "D", name: nameD },
  { key: "E", name: nameE },
];

export function PrototypeHost() {
  const variant = useSearchParams().get("variant") ?? "A";
  return (
    <>
      {variant === "A" && <LunchMap />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {variant === "D" && <VariantD />}
      {variant === "E" && <VariantE />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}
