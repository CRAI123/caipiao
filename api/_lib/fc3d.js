// 服务端抓取福彩3D开奖（复用福彩官网公告接口，name=3d）
// 返回 { id, date, num: [百, 十, 个] } 数组，最新在前
const CWL_BASE = 'https://www.cwl.gov.cn'
const API_PATH = '/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
const REFERER_3D = 'https://www.cwl.gov.cn/ygkj/wqkjgg/3d/'

export async function fetchFc3dDraws(count = 100) {
  const query =
    `name=3d&issueCount=${count}` +
    `&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}`

  const res = await fetch(`${CWL_BASE}${API_PATH}?${query}`, {
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Referer: REFERER_3D,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  })
  if (!res.ok) throw new Error(`福彩官网返回 ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data?.result) || !data.result.length) {
    throw new Error('未取到福彩3D开奖数据')
  }

  return data.result
    .map((r) => {
      const raw = String(r.red || '').replace(/\s/g, '')
      let digits
      if (raw.includes(',')) digits = raw.split(',').map(Number)
      else if (raw.length === 3) digits = raw.split('').map(Number)
      else digits = []
      return {
        id: Number(r.code),
        date: (r.date || '').replace(/\(.*\)$/, '') || null,
        num: digits.filter((n) => Number.isInteger(n) && n >= 0 && n <= 9),
      }
    })
    .filter((d) => Number.isInteger(d.id) && d.num.length === 3)
    .sort((a, b) => b.id - a.id)
}
