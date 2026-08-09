/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 科学名人名言与故事（首页「每日科学」板块数据）。
 *
 * 内容合规审核要点：
 * - 国内/华人科学家为主（约 7 成），均为官方正面宣传的科学家（两弹一星/科学家精神）；
 * - 国外人物仅选普适经典，避开政治/宗教/争议；
 * - 名言只收有据可考、广泛引用者；出处不确的改为「小故事」而非直接引语，杜绝杜撰；
 * - 全部内容导向正面（求真、勤奋、爱国、奉献），适合未成年人阅读。
 */
export interface ScienceQuote {
  id: string;
  person: { zh: string; en: string };
  /** 领域标签 */
  field: { zh: string; en: string };
  /** 国籍/年代 */
  era: { zh: string; en: string };
  /** 名言（双语）；出处不确者留空，改用 achievement */
  quote?: { zh: string; en: string };
  /** 成就概述（无名言条目替代展示，双语） */
  achievement?: { zh: string; en: string };
  /** 小故事（可折叠，双语） */
  story: { zh: string; en: string };
  /** 是否国内/华人科学家 */
  isChinese: boolean;
}

export const SCIENCE_QUOTES: ScienceQuote[] = [
  // ── 国内 / 华人（约 7 成）──
  {
    id: 'qiansen',
    person: { zh: '钱学森', en: 'Qian Xuesen' },
    field: { zh: '航天 · 力学', en: 'Aerospace · Mechanics' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '不要失去信心，只要坚持不懈，就终会有成果的。', en: 'Never lose faith — as long as you persist, results will come.' },
    story: { zh: '钱学森被誉为「中国航天之父」。他放弃美国的优越条件毅然回国，带领团队从零起步，让中国导弹与航天事业从无到有、从弱到强。', en: 'Known as the "father of Chinese spaceflight", Qian returned to China despite comfortable conditions abroad and led the country\'s missile and space program from nothing.' },
    isChinese: true,
  },
  {
    id: 'dengjiaxian',
    person: { zh: '邓稼先', en: 'Deng Jiaxian' },
    field: { zh: '核物理', en: 'Nuclear physics' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '我不爱武器，我爱和平；但为了和平，我们需要武器来保卫自己。', en: 'I do not love weapons; I love peace. But to keep peace we must be able to defend it.' },
    story: { zh: '邓稼先隐姓埋名二十八年，带领团队研制出中国第一颗原子弹和氢弹，身患绝症仍坚守戈壁，被誉为「两弹元勋」。', en: 'Deng spent 28 hidden years developing China\'s first atomic and hydrogen bombs, working on the Gobi despite illness — a founding hero of the two bombs.' },
    isChinese: true,
  },
  {
    id: 'yuanlongping',
    person: { zh: '袁隆平', en: 'Yuan Longping' },
    field: { zh: '农业科学', en: 'Agricultural science' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '人就像种子，要做一粒好种子。', en: 'A person is like a seed — strive to be a good one.' },
    story: { zh: '袁隆平一生致力于杂交水稻研究，让水稻亩产不断突破，被称为「杂交水稻之父」，为保障粮食安全作出巨大贡献。', en: 'Yuan devoted his life to hybrid rice, repeatedly raising yields — the "father of hybrid rice" who helped secure food for billions.' },
    isChinese: true,
  },
  {
    id: 'tu-youyou',
    person: { zh: '屠呦呦', en: 'Tu Youyou' },
    field: { zh: '药学', en: 'Pharmacology' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '中医药学是一个伟大的宝库，应当努力发掘。', en: 'Traditional Chinese medicine is a great treasure-house that deserves to be explored.' },
    story: { zh: '屠呦呦从古籍中获得灵感，发现青蒿素治疗疟疾，成为首位获诺贝尔科学奖的中国本土科学家。', en: 'Inspired by ancient texts, Tu discovered artemisinin for malaria — the first mainland Chinese scientist to win a Nobel science prize.' },
    isChinese: true,
  },
  {
    id: 'hualuogeng',
    person: { zh: '华罗庚', en: 'Hua Luogeng' },
    field: { zh: '数学', en: 'Mathematics' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '聪明在于勤奋，天才在于积累。', en: 'Wisdom comes from diligence; genius comes from accumulation.' },
    story: { zh: '华罗庚只有初中学历，靠自学成为世界著名数学家，创立「华氏定理」，并回国推动中国数学事业。', en: 'Self-taught from middle school, Hua became a world-famous mathematician, founded "Hua\'s theorem" and advanced Chinese mathematics.' },
    isChinese: true,
  },
  {
    id: 'chenjingrun',
    person: { zh: '陈景润', en: 'Chen Jingrun' },
    field: { zh: '数学', en: 'Mathematics' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '攀登科学高峰，就像登山运动员攀登珠穆朗玛峰一样，要克服无数艰难险阻。', en: 'Climbing the peak of science is like climbing Everest — countless hardships must be overcome.' },
    story: { zh: '陈景润在六平方米的小屋里，用几麻袋草稿纸证明了「1+2」，离哥德巴赫猜想的世界难题只差一步。', en: 'In a tiny room with sacks of draft paper, Chen proved "1+2", coming within one step of Goldbach\'s conjecture.' },
    isChinese: true,
  },
  {
    id: 'lisiguang',
    person: { zh: '李四光', en: 'Li Siguang' },
    field: { zh: '地质学', en: 'Geology' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '科学尊重事实，服从真理，而不会屈服于任何压力。', en: 'Science respects facts and truth, and bows to no pressure.' },
    story: { zh: '李四光创立地质力学理论，用科学方法指导中国石油勘探，摘掉了「中国贫油」的帽子。', en: 'Li founded geomechanics and guided China\'s oil exploration with science, overturning the "no oil in China" claim.' },
    isChinese: true,
  },
  {
    id: 'houdebang',
    person: { zh: '侯德榜', en: 'Hou Debang' },
    field: { zh: '化学工程', en: 'Chemical engineering' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '我的一切发明都属于祖国。', en: 'All my inventions belong to my motherland.' },
    story: { zh: '侯德榜发明「侯氏制碱法」，打破国外制碱技术垄断，把技术无偿公之于世，被誉为中国化工先驱。', en: 'Hou invented the "Hou process" for soda, broke foreign monopoly, and shared the technology freely — a pioneer of Chinese chemistry.' },
    isChinese: true,
  },
  {
    id: 'zhangheng',
    person: { zh: '张衡', en: 'Zhang Heng' },
    field: { zh: '天文学 · 古代', en: 'Astronomy · Ancient' },
    era: { zh: '中国 · 东汉', en: 'China · Eastern Han' },
    quote: { zh: '人生在勤，不索何获。', en: 'Life thrives on diligence — nothing is gained without seeking.' },
    story: { zh: '张衡发明了世界上最早的地动仪（候风地动仪），能测定地震方位，比欧洲同类仪器早约 1700 年。', en: 'Zhang built the world\'s first seismoscope, detecting earthquake directions some 1700 years before similar European instruments.' },
    isChinese: true,
  },
  {
    id: 'zuchongzhi',
    person: { zh: '祖冲之', en: 'Zu Chongzhi' },
    field: { zh: '数学 · 天文', en: 'Mathematics · Astronomy' },
    era: { zh: '中国 · 南朝', en: 'China · Southern Dynasties' },
    achievement: { zh: '把圆周率精确到小数点后第 7 位，领先世界近千年', en: 'Computed pi to 7 decimal places — a world record for nearly 1000 years' },
    story: { zh: '祖冲之把圆周率精确到小数点后第 7 位（3.1415926～3.1415927），领先世界近千年，月球上还有以他命名的环形山。', en: 'Zu computed π to seven decimal places — a world record for nearly a thousand years. A lunar crater bears his name.' },
    isChinese: true,
  },
  {
    id: 'shenkuo',
    person: { zh: '沈括', en: 'Shen Kuo' },
    field: { zh: '综合科学 · 古代', en: 'General science · Ancient' },
    era: { zh: '中国 · 北宋', en: 'China · Northern Song' },
    achievement: { zh: '《梦溪笔谈》被誉为「中国科学史上的里程碑」，最早命名「石油」', en: 'Dream Pool Essays — a milestone of Chinese science; first to name petroleum' },
    story: { zh: '沈括的《梦溪笔谈》被誉为「中国科学史上的里程碑」，书中最早命名了「石油」，并记录了地磁偏角现象。', en: 'Shen\'s Dream Pool Essays is a milestone of Chinese science — it first named "petroleum" and recorded magnetic declination.' },
    isChinese: true,
  },
  {
    id: 'yangzhenning',
    person: { zh: '杨振宁', en: 'Chen-Ning Yang' },
    field: { zh: '理论物理', en: 'Theoretical physics' },
    era: { zh: '华人 · 现代', en: 'Chinese · Modern' },
    achievement: { zh: '与李政道提出「宇称不守恒」，获诺贝尔物理学奖', en: 'With T.D. Lee, proposed parity non-conservation — Nobel Prize in Physics' },
    story: { zh: '杨振宁与李政道因提出「宇称不守恒」获诺贝尔物理学奖，他是理论物理领域影响最深远的华人科学家之一。', en: 'With T.D. Lee, Yang won the Nobel Prize in Physics for parity non-conservation — among the most influential Chinese physicists.' },
    isChinese: true,
  },
  {
    id: 'lizhengdao',
    person: { zh: '李政道', en: 'Tsung-Dao Lee' },
    field: { zh: '理论物理', en: 'Theoretical physics' },
    era: { zh: '华人 · 现代', en: 'Chinese · Modern' },
    quote: { zh: '科学和艺术是一枚硬币的两面。', en: 'Science and art are two sides of the same coin.' },
    story: { zh: '李政道 31 岁获诺贝尔物理学奖，是历史上第二年轻的诺奖得主，晚年积极推动中国基础科学教育。', en: 'Lee won the Nobel at 31 — the second youngest ever — and later championed basic science education in China.' },
    isChinese: true,
  },
  {
    id: 'wujianxiong',
    person: { zh: '吴健雄', en: 'Chien-Shiung Wu' },
    field: { zh: '实验物理', en: 'Experimental physics' },
    era: { zh: '华人 · 现代', en: 'Chinese · Modern' },
    achievement: { zh: '用实验证实「宇称不守恒」，被誉为「核物理女王」', en: 'Her experiment proved parity non-conservation — the queen of nuclear physics' },
    story: { zh: '吴健雄用实验证实「宇称不守恒」，被誉为「核物理女王」，是 20 世纪最杰出的实验物理学家之一。', en: 'Wu\'s experiment confirmed parity non-conservation — the "queen of nuclear physics" and one of the century\'s finest experimentalists.' },
    isChinese: true,
  },
  {
    id: 'gaokun',
    person: { zh: '高锟', en: 'Charles Kao' },
    field: { zh: '光学工程', en: 'Optical engineering' },
    era: { zh: '华人 · 现代', en: 'Chinese · Modern' },
    achievement: { zh: '提出光纤通信原理，获诺贝尔物理学奖，被誉为「光纤之父」', en: 'Founded fiber-optic communication — Nobel laureate, the father of fiber optics' },
    story: { zh: '高锟提出用玻璃纤维传输光信号，奠定光纤通信基础，获诺贝尔物理学奖，被誉为「光纤之父」。', en: 'Kao proposed transmitting light through glass fibers, founding fiber-optic communication and winning the Nobel — the "father of fiber optics".' },
    isChinese: true,
  },
  {
    id: 'wangxuan',
    person: { zh: '王选', en: 'Wang Xuan' },
    field: { zh: '计算机科学', en: 'Computer science' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    achievement: { zh: '发明汉字激光照排技术，让中文印刷告别铅与火', en: 'Laser typesetting for Chinese characters — the modern Bi Sheng of printing' },
    story: { zh: '王选发明汉字激光照排技术，让中文印刷告别铅与火、迎来光与电，被称为「当代毕昇」。', en: 'Wang\'s laser typesetting for Chinese characters ended the age of lead type — the "modern Bi Sheng" of printing.' },
    isChinese: true,
  },
  {
    id: 'yumin',
    person: { zh: '于敏', en: 'Yu Min' },
    field: { zh: '核物理', en: 'Nuclear physics' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '一个人的名字，早晚是要没有的，能把微薄的力量融进祖国的强盛之中，便足以自慰了。', en: 'A name fades in time; what endures is a little strength poured into the nation\'s rise.' },
    story: { zh: '于敏在完全自主的条件下攻克氢弹理论，被誉为「中国氢弹之父」，隐姓埋名数十载。', en: 'Yu solved the hydrogen-bomb theory entirely on his own — the "father of China\'s H-bomb", hidden from public view for decades.' },
    isChinese: true,
  },
  {
    id: 'nandongren',
    person: { zh: '南仁东', en: 'Nan Rendong' },
    field: { zh: '天文学', en: 'Astronomy' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    achievement: { zh: '主持建成「中国天眼」FAST——世界最大单口径射电望远镜', en: 'Built FAST, the world largest single-dish radio telescope' },
    story: { zh: '南仁东用 22 年主持建成「中国天眼」FAST——世界最大单口径射电望远镜，被誉为「天眼之父」。', en: 'Nan spent 22 years building FAST, the world\'s largest single-dish radio telescope — the "father of the Sky Eye".' },
    isChinese: true,
  },
  {
    id: 'yeqisun',
    person: { zh: '叶企孙', en: 'Ye Qisun' },
    field: { zh: '物理学教育', en: 'Physics education' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    achievement: { zh: '创办清华物理系，培养出钱三强、邓稼先、杨振宁等一批科学巨匠', en: 'Founded Tsinghua physics; mentored generations of scientific masters' },
    story: { zh: '叶企孙创办清华物理系，培养出钱三强、邓稼先、杨振宁、李政道等一批科学巨匠，是「大师的老师」。', en: 'Ye founded Tsinghua\'s physics department and mentored Qian Sanqiang, Deng Jiaxian, Yang and Lee — a teacher of masters.' },
    isChinese: true,
  },
  {
    id: 'maoyisheng',
    person: { zh: '茅以升', en: 'Mao Yisheng' },
    field: { zh: '桥梁工程', en: 'Bridge engineering' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '困难只能吓倒懦夫懒汉，而胜利永远属于敢于攀登科学高峰的人。', en: 'Difficulties only scare the faint-hearted; victory belongs to those who dare to climb.' },
    story: { zh: '茅以升主持建造钱塘江大桥——中国人自己设计建造的第一座现代化大桥，历经抗战烽火依然屹立。', en: 'Mao built the Qiantang River Bridge, the first modern bridge designed by Chinese engineers, which survived the war years.' },
    isChinese: true,
  },
  {
    id: 'subuqing',
    person: { zh: '苏步青', en: 'Su Buqing' },
    field: { zh: '数学', en: 'Mathematics' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    quote: { zh: '为学须先立志。', en: 'To learn, one must first set a goal.' },
    story: { zh: '苏步青在微分几何领域取得世界级成就，创立「苏锥面」等理论，晚年仍坚持带学生、做学问。', en: 'Su achieved world-class results in differential geometry (founding the "Su cone"), teaching until late in life.' },
    isChinese: true,
  },
  {
    id: 'linshouqiao',
    person: { zh: '林巧稚', en: 'Lin Qiaozhi' },
    field: { zh: '医学', en: 'Medicine' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    achievement: { zh: '一生接生五万多个婴儿，被誉为「万婴之母」', en: 'Delivered over 50,000 babies — the mother of ten thousand infants' },
    story: { zh: '林巧稚一生接生五万多个婴儿，被誉为「万婴之母」，是中国妇产科学的奠基人。', en: 'Lin delivered over 50,000 babies — the "mother of ten thousand infants" and founder of Chinese obstetrics.' },
    isChinese: true,
  },
  {
    id: 'hutiming',
    person: { zh: '胡先骕', en: 'Hu Xiansu' },
    field: { zh: '植物学', en: 'Botany' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    achievement: { zh: '中国植物分类学之父，让「活化石」水杉震惊世界', en: 'Father of Chinese plant taxonomy; unveiled the living-fossil dawn redwood' },
    story: { zh: '胡先骕是「中国植物分类学之父」，最早提出「活化石」水杉的科学发现，让世界为之震惊。', en: 'Hu, father of Chinese plant taxonomy, brought the "living fossil" dawn redwood to the world\'s attention.' },
    isChinese: true,
  },
  {
    id: 'qiansanqiang',
    person: { zh: '钱三强', en: 'Qian Sanqiang' },
    field: { zh: '核物理', en: 'Nuclear physics' },
    era: { zh: '中国 · 现代', en: 'China · Modern' },
    achievement: { zh: '发现铀核三分裂现象，组织中国核科学队伍', en: 'Discovered ternary fission; organized China nuclear science teams' },
    story: { zh: '钱三强发现铀核三分裂现象，回国后组织中国核科学队伍，为「两弹一星」作出卓越贡献。', en: 'Qian discovered ternary fission, then organized China\'s nuclear science teams — vital to the two bombs and satellite program.' },
    isChinese: true,
  },


  // ── 国外经典（约 3 成）──
  {
    id: 'newton',
    person: { zh: '牛顿', en: 'Isaac Newton' },
    field: { zh: '物理 · 数学', en: 'Physics · Math' },
    era: { zh: '英国 · 17 世纪', en: 'UK · 17th c.' },
    quote: { zh: '如果我看得更远，那是因为我站在巨人的肩膀上。', en: 'If I have seen further, it is by standing on the shoulders of giants.' },
    story: { zh: '牛顿在瘟疫居家期间完成微积分、万有引力和光学三大发现，26 岁就成为剑桥大学教授。', en: 'During a plague-enforced break, Newton produced calculus, gravitation and optics — professor at Cambridge by 26.' },
    isChinese: false,
  },
  {
    id: 'einstein',
    person: { zh: '爱因斯坦', en: 'Albert Einstein' },
    field: { zh: '理论物理', en: 'Theoretical physics' },
    era: { zh: '德国 · 20 世纪', en: 'Germany · 20th c.' },
    quote: { zh: '想象力比知识更重要。', en: 'Imagination is more important than knowledge.' },
    story: { zh: '爱因斯坦 26 岁一年内发表四篇划时代论文，提出狭义相对论，彻底改变人类对时空的认识。', en: 'At 26, Einstein published four landmark papers in one year, including special relativity — transforming our view of space and time.' },
    isChinese: false,
  },
  {
    id: 'curie',
    person: { zh: '居里夫人', en: 'Marie Curie' },
    field: { zh: '化学 · 物理', en: 'Chemistry · Physics' },
    era: { zh: '波兰/法国 · 19-20 世纪', en: 'Poland/France · 19-20th c.' },
    quote: { zh: '生活中没有什么可怕的东西，只有需要理解的东西。', en: 'Nothing in life is to be feared, only to be understood.' },
    story: { zh: '居里夫人在简陋棚屋里从数吨沥青铀矿中提炼出镭，两次获诺贝尔奖，是放射性研究的先驱。', en: 'In a leaky shed Curie isolated radium from tons of ore, won two Nobel Prizes, and pioneered radioactivity research.' },
    isChinese: false,
  },
  {
    id: 'galileo',
    person: { zh: '伽利略', en: 'Galileo Galilei' },
    field: { zh: '物理 · 天文', en: 'Physics · Astronomy' },
    era: { zh: '意大利 · 16-17 世纪', en: 'Italy · 16-17th c.' },
    quote: { zh: '真理是时间的女儿，不是权威的女儿。', en: 'Truth is the daughter of time, not of authority.' },
    story: { zh: '伽利略用望远镜观测天体，支持日心说，还通过斜面实验研究落体运动，被誉为「近代科学之父」。', en: 'Galileo\'s telescope observations supported heliocentrism; his inclined-plane experiments founded modern physics.' },
    isChinese: false,
  },
  {
    id: 'faraday',
    person: { zh: '法拉第', en: 'Michael Faraday' },
    field: { zh: '物理 · 化学', en: 'Physics · Chemistry' },
    era: { zh: '英国 · 19 世纪', en: 'UK · 19th c.' },
    quote: { zh: '拼命去争取成功，但不要期望一定会成功。', en: 'Strive to succeed, but do not expect success to be certain.' },
    story: { zh: '只读过小学的法拉第发现了电磁感应现象，发明第一台发电机，让人类进入电气时代。', en: 'Largely self-taught, Faraday discovered electromagnetic induction and built the first generator — ushering in the electric age.' },
    isChinese: false,
  },
  {
    id: 'edison',
    person: { zh: '爱迪生', en: 'Thomas Edison' },
    field: { zh: '发明', en: 'Invention' },
    era: { zh: '美国 · 19-20 世纪', en: 'USA · 19-20th c.' },
    quote: { zh: '天才是 1% 的灵感加上 99% 的汗水。', en: 'Genius is 1% inspiration and 99% perspiration.' },
    story: { zh: '爱迪生为寻找合适的灯丝材料试验了上千种物质，最终让电灯照亮世界。', en: 'Edison tested thousands of materials for a filament before the light bulb lit the world.' },
    isChinese: false,
  },
  {
    id: 'darwin',
    person: { zh: '达尔文', en: 'Charles Darwin' },
    field: { zh: '生物学', en: 'Biology' },
    era: { zh: '英国 · 19 世纪', en: 'UK · 19th c.' },
    quote: { zh: '物竞天择，适者生存。', en: 'Natural selection — survival of the fittest.' },
    story: { zh: '达尔文历时五年环球航行，观察大量生物，二十多年后出版《物种起源》，奠定进化论。', en: 'Darwin\'s five-year voyage and decades of study produced On the Origin of Species, founding evolutionary biology.' },
    isChinese: false,
  },
  {
    id: 'mendeleev',
    person: { zh: '门捷列夫', en: 'Dmitri Mendeleev' },
    field: { zh: '化学', en: 'Chemistry' },
    era: { zh: '俄国 · 19 世纪', en: 'Russia · 19th c.' },
    quote: { zh: '天才只意味着终身不懈的努力。', en: 'Genius only means lifelong, tireless effort.' },
    story: { zh: '门捷列夫排出元素周期表，并大胆预言了尚未发现的元素及其性质，后来都被证实。', en: 'Mendeleev\'s periodic table predicted unknown elements and their properties — all later confirmed.' },
    isChinese: false,
  },
  {
    id: 'archimedes',
    person: { zh: '阿基米德', en: 'Archimedes' },
    field: { zh: '数学 · 物理', en: 'Math · Physics' },
    era: { zh: '古希腊', en: 'Ancient Greece' },
    quote: { zh: '给我一个支点，我就能撬动地球。', en: 'Give me a lever long enough and a fulcrum, and I can move the world.' },
    story: { zh: '阿基米德在浴缸中发现浮力原理，光着身子跑上大街高喊「尤里卡！」——「我找到了！」。', en: 'Archimedes discovered buoyancy in his bath and ran into the street shouting "Eureka!" — "I have found it!"' },
    isChinese: false,
  },
  {
    id: 'gauss',
    person: { zh: '高斯', en: 'Carl Friedrich Gauss' },
    field: { zh: '数学', en: 'Mathematics' },
    era: { zh: '德国 · 18-19 世纪', en: 'Germany · 18-19th c.' },
    quote: { zh: '数学是科学之王。', en: 'Mathematics is the queen of the sciences.' },
    story: { zh: '高斯 10 岁就快速算出 1 到 100 的和，19 岁解决千年难题——正十七边形尺规作图问题。', en: 'At 10 Gauss summed 1–100 instantly; at 19 he solved the ancient problem of constructing a 17-gon with compass and straightedge.' },
    isChinese: false,
  },
];

/** 中文占比（用于界面标注） */
export const CHINESE_QUOTE_RATIO = SCIENCE_QUOTES.filter((q) => q.isChinese).length / SCIENCE_QUOTES.length;
