// 解析 500.com 开奖 XML（形如 <row expect="2026300" opencode="1,9,0" opentime="2026-11-10 21:15:00"/>）
// 作为福彩官网被墙 / 403 时的备用数据源。返回 [{ issue, code, date }]，最新在前。
const ROW_RE = /<row\s+([^>]*?)\/?>/g
const ATTR_RE = /(\w+)="([^"]*)"/g

export function parse500Rows(text) {
  const rows = []
  let m
  while ((m = ROW_RE.exec(text))) {
    const attrs = {}
    let a
    while ((a = ATTR_RE.exec(m[1]))) attrs[a[1]] = a[2]
    const issue = Number(attrs.expect)
    if (Number.isInteger(issue) && attrs.opencode) {
      rows.push({
        issue,
        code: attrs.opencode,
        date: (attrs.opentime || '').slice(0, 10) || null,
      })
    }
  }
  return rows.sort((x, y) => y.issue - x.issue)
}

export const UA_500 =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
