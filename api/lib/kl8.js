// 服务端抓取福彩官网开奖数据（Vercel Serverless Functions）
// 服务端直连官网，带 Referer 头，无浏览器跨域问题

const CWL_BASE = 'https://www.cwl.gov.cn'
const API_PATH = '/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'

/**
 * 抓取最近 count 期快乐8开奖。
 * 返回 { id, date, nums: number[20] } 数组，最新在前；失败时抛错。
 */
export async function fetchKl8Draws(count = 10) {
  const query =
    `name=kl8&issueCount=${count}` +
    `&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}`
  const url = `${CWL_BASE}${API_PATH}?${query}`
  const res = await fetch(url, {
    headers: {
      Referer: 'https://www.cwl.gov.cn/ygkj/wqkjgg/kl8/',
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  })
  if (!res.ok) throw new Error(`福彩官网 HTTP ${res.status}`)
  const data = await res.json()
  if (data.state !== 0 || !Array.isArray(data.result)) {
    throw new Error(data.message || '福彩官网接口返回异常')
  }
  return data.result
    .map((r) => ({
      id: Number(r.code),
      date: (r.date || '').replace(/\(.*\)$/, '') || null,
      nums: String(r.red || '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 80)
        .sort((a, b) => a - b),
    }))
    .filter((d) => Number.isInteger(d.id) && d.nums.length === 20)
    .sort((a, b) => b.id - a.id)
}
