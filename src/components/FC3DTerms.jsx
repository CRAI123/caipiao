// 福彩3D 术语大全 —— 所有术语的参考说明
import React from 'react'
import { Card } from './common.jsx'

const TERMS = [
  {
    title: '形态',
    items: [
      { name: '豹子', desc: '三个数字全部相同', example: '例：222' },
      { name: '顺子', desc: '三个数字为连续号码', example: '例：123、689、731' },
      { name: '对子（组三）', desc: '三个号码里有两个数字相同', example: '两数一样' },
      { name: '组六', desc: '三个数字全都不相同', example: '' },
    ],
  },
  {
    title: '数值类',
    items: [
      { name: '跨度', desc: '一注号码里，最大数 − 最小数', example: '' },
      { name: '和值', desc: '三个数字相加得到的总和', example: '' },
      { name: '合值', desc: '三个数字相加的和值取个位', example: '例：139，和值13，合值为3' },
    ],
  },
  {
    title: '奇偶',
    items: [
      { name: '奇偶', desc: '三个号码区分奇数、偶数，共 8 种组合形态', example: '奇奇奇、奇奇偶……' },
    ],
  },
  {
    title: '大中小',
    items: [
      { name: '小号', desc: '0、1、2', example: '' },
      { name: '中号', desc: '3、4、5、6', example: '' },
      { name: '大号', desc: '7、8、9', example: '' },
    ],
  },
  {
    title: '质数、合数（彩民常用划分）',
    items: [
      { name: '质数', desc: '1、2、3、5、7', example: '' },
      { name: '合数', desc: '0、4、6、8、9', example: '' },
    ],
  },
  {
    title: '单双组合',
    items: [
      { name: '单数组合', desc: '全奇数组合', example: '139、157、379、357' },
      { name: '双数组合', desc: '全偶数组合', example: '028、268、046、248' },
      { name: '两单（两奇）', desc: '两个奇数搭配', example: '13、19、39、15、17、57、37' },
      { name: '两双（两偶）', desc: '两个偶数搭配', example: '02、08、28、26、68、04、06' },
    ],
  },
  {
    title: '奇偶搭配形态',
    items: [
      { name: '两单一双', desc: '两个奇数 + 一个偶数', example: '130、132、134、136、138、190、194、572、794' },
      { name: '两双一单', desc: '两个偶数 + 一个奇数', example: '021、023、025、027、029、081、085、087、012' },
    ],
  },
  {
    title: '其他常用概念',
    items: [
      { name: '遗漏', desc: '某个号码或者某种形态，距离上次开出间隔的期数', example: '' },
      { name: '冷热号', desc: '热号 = 近期频繁开出的号码；冷号 = 很久没有开出的号码', example: '' },
    ],
  },
]

const PL5_TERMS = [
  {
    title: '形态（按重复结构）',
    items: [
      { name: '五同', desc: '五个数字全部相同', example: '例：22222' },
      { name: '四同一异', desc: '四个相同 + 一个不同', example: '例：77771' },
      { name: '三同二同', desc: '三个相同 + 另外两个相同', example: '例：55500' },
      { name: '三同两异', desc: '三个相同 + 两个不同', example: '例：88832' },
      { name: '两对一异', desc: '两对相同 + 一个不同', example: '例：22449' },
      { name: '两同一异二异', desc: '一对相同，其余三个各不相同', example: '例：66318' },
      { name: '全不同', desc: '五个数字互不相同', example: '例：13579' },
    ],
  },
  {
    title: '数值类',
    items: [
      { name: '跨度', desc: '五个数字里最大数 − 最小数', example: '范围 0 – 9' },
      { name: '和值', desc: '五个数字相加的总和', example: '范围 0 – 45，均值 22.5' },
      { name: '合值', desc: '和值取个位', example: '例：03243，和值12，合值2' },
    ],
  },
  {
    title: '奇偶',
    items: [
      { name: '奇偶形态', desc: '五个位置区分奇偶，共 32 种组合形态', example: '奇奇奇奇奇、奇偶奇偶奇……' },
    ],
  },
  {
    title: '大中小',
    items: [
      { name: '小号', desc: '0、1、2', example: '' },
      { name: '中号', desc: '3、4、5、6', example: '' },
      { name: '大号', desc: '7、8、9', example: '' },
    ],
  },
  {
    title: '质数、合数（彩民常用划分）',
    items: [
      { name: '质数', desc: '1、2、3、5、7', example: '' },
      { name: '合数', desc: '0、4、6、8、9', example: '' },
    ],
  },
  {
    title: '玩法与奖金',
    items: [
      { name: '直选', desc: '五个位置与开奖完全相同才中奖，单注 2 元', example: '单注奖金 100,000 元' },
      { name: '中奖概率', desc: '00000–99999 共 10 万种等概率结果', example: '1 / 100,000' },
    ],
  },
  {
    title: '其他常用概念',
    items: [
      { name: '遗漏', desc: '某个号码或者某种形态，距离上次开出间隔的期数', example: '' },
      { name: '冷热号', desc: '热号 = 近期频繁开出的号码；冷号 = 很久没有开出的号码', example: '' },
    ],
  },
]

export default function FC3DTerms({ label = '福彩3D', digitCount = 3 }) {
  const groups = digitCount === 5 ? PL5_TERMS : TERMS
  return (
    <div className="page">
      <Card title="术语大全" tag={`${label} 常用术语参考`}>
        <p className="muted small">
          以下术语均已在本站各分析页中实现为功能：跨度/和值/奇偶/大中小/质合/形态/遗漏/冷热。
          开奖为完全随机独立事件，术语仅为数据描述，不构成投注建议。
        </p>
      </Card>
      {groups.map((group) => (
        <Card key={group.title} title={group.title}>
          <div className="term-grid">
            {group.items.map((t) => (
              <div key={t.name} className="term-card">
                <div className="term-name">{t.name}</div>
                <div className="term-desc">{t.desc}</div>
                {t.example && <div className="term-example">{t.example}</div>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
