import { createMcpHandler } from "mcp-handler";
import { registerLunchTools } from "@/lib/server/mcpTools";

// 점심 지도 MCP 서버 (Streamable HTTP, 읽기 전용, 인증 없음). 연결 방법은 README 「Claude에 점심 지도 연결하기」.
const handler = createMcpHandler(registerLunchTools, {
  serverInfo: { name: "myeongjeong-lunch-map", version: "1.0.0" },
  instructions: "명정 캠퍼스(서울 서초구 반포대로 45 명정빌딩) 근처 점심 가게 지도. 도보 시간은 모두 캠퍼스 기준이다. 모든 도구는 읽기 전용이다.",
});

export { handler as GET, handler as POST, handler as DELETE };
