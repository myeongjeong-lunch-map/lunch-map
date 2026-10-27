import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LunchView } from '../types'

// 오늘 점심: 명정 점심 지도 MCP(lunch-map)에서 추천 한 곳과 이번 주 랭킹을 받아 패널에 보여 준다.
// /lunch [조건] — 조건은 카테고리(한식·분식…)나 "10분" 같은 최대 도보 시간.

const SERVER = 'lunch-map'
const PANE = 'lunch-today'
const TITLE = '🍱 오늘 점심'
const CATEGORIES = ['한식', '중식', '일식', '양식', '아시안', '분식', '패스트푸드', '카페', '기타']

const view = atom({ plugin: 'lunch-today', key: 'view' } as const, {
  filter: '',
  pick: '',
  ranking: '',
  isLoading: false,
  error: '',
  at: '',
} as LunchView)

/** "한식 10분" → { category: "한식", maxMinutes: 10 } */
function parseFilter(text: string): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const min = word.match(/^(\d{1,2})분?$/)
    if (min) args.maxMinutes = Number(min[1])
    else if (CATEGORIES.includes(word)) args.category = word
    else args.query = word
  }
  return args
}

function textOf(result: { content: { type: string; text?: string }[]; isError: boolean }): string {
  return result.content
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('\n')
}

function clock(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MCP_URL = 'https://myeongjeong-lunch-map.vercel.app/api/mcp'

/** MCP 서버에 HTTP(JSON-RPC)로 직접 도구를 부른다. 연결된 MCP 호출이 거부될 때 쓴다 */
async function callOverHttp($: EngineInterface, tool: string, args: Record<string, unknown>): Promise<string> {
  const res = await $.http.fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  // 응답은 SSE("data: {...}") 또는 JSON 하나
  const raw = res.text.split('\n').find(line => line.startsWith('data: '))?.slice(6) ?? res.text
  const msg = JSON.parse(raw) as { result?: { content: { type: string; text?: string }[]; isError: boolean }; error?: { message: string } }
  if (!msg.result) throw new Error(msg.error?.message ?? '응답이 비었어요')
  return textOf(msg.result)
}

/** 연결된 lunch-map MCP로 부르고, 거부되면 한 번 더, 그래도 안 되면 HTTP로 직접 부른다 */
async function callTool($: EngineInterface, tool: string, args: Record<string, unknown>): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return textOf(await $.mcp.call(SERVER, tool, args))
    } catch {
      // auto mode 판단이 비거나 연결이 없을 때. 다시 시도한다
    }
  }
  return callOverHttp($, tool, args)
}

// 추천과 랭킹을 다시 불러온다. 조건을 주면 그 조건으로 바꾼다
async function refresh($: EngineInterface, filter?: string): Promise<void> {
  const prev = await read($, view)
  const f = filter ?? prev.filter
  await update($, view, v => ({ ...v, filter: f, isLoading: true, error: '' }))
  try {
    const [pick, ranking] = await Promise.all([
      callTool($, 'pick_lunch', parseFilter(f)),
      callTool($, 'get_ranking', { period: 'week', limit: 3 }),
    ])
    const at = clock(await $.clock.now())
    await update($, view, v => ({
      ...v,
      pick,
      ranking,
      isLoading: false,
      at,
    }))
  } catch (err) {
    await update($, view, v => ({
      ...v,
      isLoading: false,
      error: `점심 지도에 연결하지 못했어요. 잠시 뒤 다시 뽑기를 눌러 주세요. (${(err as Error).message})`,
    }))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // 명령 이름은 영문·숫자·_·- 만 된다 (한글 이름은 거부된다)
    await $.command.register({ name: 'lunch', description: '🍱 오늘 점심 추천 패널 열기 (예: /lunch 한식 10분)' })
    return next(e)
  })

  on('command.run', { command: 'lunch' }, async ($, e) => {
    await $.ui.open({ id: PANE, title: TITLE })
    await refresh($, e.args.trim())
    return { text: '🍱 오늘 점심 패널을 열었어요.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const v = await read($, view)
    const lines = (s: string) => s.split('\n').map(line => line.replace(/\s*\[id: [0-9a-f-]+\]/, ''))

    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>
          명정빌딩 기준 · 조건: {v.filter || '없음'}
          {v.at ? ` · ${v.at} 기준` : ''}
        </Text>
        {v.error ? <Text color="red">{v.error}</Text> : null}
        {v.isLoading && !v.pick ? <Text dimColor>불러오는 중…</Text> : null}
        {v.pick ? (
          <Box flexDirection="column">
            <Text bold>🎲 오늘의 추천</Text>
            {lines(v.pick).map(line => (
              <Text>{line}</Text>
            ))}
          </Box>
        ) : null}
        <Box flexDirection="row" gap={1}>
          <Button key="reroll" hotkey="r" label={v.isLoading ? '고르는 중…' : '🎲 다시 뽑기'} onPress={() => void refresh($)} />
          {v.filter ? <Button key="clear" hotkey="c" label="조건 지우기" onPress={() => void refresh($, '')} /> : null}
        </Box>
        {v.ranking ? (
          <Box flexDirection="column">
            <Text bold>🏆 이번 주 랭킹</Text>
            {lines(v.ranking)
              .slice(1)
              .map(line => (
                <Text>{line}</Text>
              ))}
          </Box>
        ) : null}
        <Text dimColor>/lunch 한식 10분 처럼 조건을 붙여 다시 열 수 있어요.</Text>
      </Box>
    )
  })
}
