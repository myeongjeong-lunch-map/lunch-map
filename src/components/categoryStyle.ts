import type { Category } from "@/lib/domain";

export const CATEGORY_EMOJI: Record<Category, string> = {
  한식: "🍚",
  중식: "🥟",
  일식: "🍣",
  양식: "🍝",
  아시안: "🍜",
  분식: "🍢",
  패스트푸드: "🍔",
  카페: "☕",
  기타: "🍴",
};

export const CATEGORY_COLOR: Record<Category, string> = {
  한식: "#ff6b3d",
  중식: "#e5383b",
  일식: "#4361ee",
  양식: "#f4a261",
  아시안: "#2a9d8f",
  분식: "#ff4d8d",
  패스트푸드: "#fca311",
  카페: "#a47148",
  기타: "#6c757d",
};
