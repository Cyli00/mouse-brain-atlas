import { corticalRegionOutlines } from "./cortical-regions";

export type BrainReference = {
  title: string;
  authors: string;
  year: number;
  journal: string;
  url: string;
  finding: string;
};

export type BrainRegion = {
  id: number;
  acronym: string;
  name: string;
  englishName: string;
  category: string;
  color: string;
  summary: string;
  function: string;
  evidence: string;
  references: BrainReference[];
  evidenceScope?: "anatomy";
  surfaceRole?: "cavity";
};

export const atlasReferences: BrainReference[] = [
  {
    title:
      "The Allen Mouse Brain Common Coordinate Framework: A 3D Reference Atlas",
    authors: "Wang Q, Ding SL, Li Y, et al.",
    year: 2020,
    journal: "Cell",
    url: "https://doi.org/10.1016/j.cell.2020.04.007",
    finding:
      "以 1,675 只青年成年 C57BL/6J 小鼠的成像数据建立平均模板，并在三维空间标注脑区。它提供解剖坐标，不直接测量脑区功能。",
  },
  {
    title: "A mesoscale connectome of the mouse brain",
    authors: "Oh SW, Harris JA, Ng L, et al.",
    year: 2014,
    journal: "Nature",
    url: "https://doi.org/10.1038/nature13186",
    finding:
      "通过病毒示踪和全脑成像构建小鼠介观连接图谱。轴突投射证据描述解剖连接，本身不证明行为功能或突触作用方向。",
  },
];

const flexibleLearning: BrainReference = {
  title:
    "Infralimbic cortex is required for learning alternatives to prelimbic promoted associations through reciprocal connectivity",
  authors: "Mukherjee A, Caroni P",
  year: 2018,
  journal: "Nature Communications",
  url: "https://doi.org/10.1038/s41467-018-05318-x",
  finding:
    "小鼠学习实验结合通路操控，发现 PL 与 ILA 的相互连接参与既有联结的应用和替代联结的学习。作用取决于任务与学习阶段。",
};

const thalamicAttention: BrainReference = {
  title:
    "Thalamic amplification of cortical connectivity sustains attentional control",
  authors: "Schmitt LI, Wimmer RD, Nakajima M, et al.",
  year: 2017,
  journal: "Nature",
  url: "https://doi.org/10.1038/nature22073",
  finding:
    "在小鼠视听选择任务中，内侧背核支持前额叶中规则表征的维持；记录与操控结果支持丘脑对皮层网络相互作用的调节。",
};

const coreBrainRegions: BrainRegion[] = [
  {
    id: 972,
    acronym: "PL",
    name: "前边缘皮层",
    englishName: "Prelimbic area",
    category: "大脑皮层",
    color: "#2FA850",
    summary:
      "PL 位于小鼠内侧前额叶，是研究规则选择和学习的常用区域。小鼠实验显示，它与丘脑及邻近的下边缘皮层共同参与任务相关信息的维持与使用。",
    function: "按照学习到的规则选择行为，参与联结学习。",
    evidence:
      "证据来自特定行为任务中的神经记录与通路操控。小鼠 PL 不能直接等同于人类某一前额叶分区，功能也不由解剖边界独占。",
    references: [thalamicAttention, flexibleLearning],
  },
  {
    id: 44,
    acronym: "ILA",
    name: "下边缘皮层",
    englishName: "Infralimbic area",
    category: "大脑皮层",
    color: "#59B363",
    summary:
      "ILA 与 PL 相邻，常用于研究原有反应如何随经验改变。在小鼠听觉恐惧消退实验中，操控 ILA 会改变消退训练后对声音线索的恐惧表达。",
    function: "参与替代联结学习及恐惧消退后的反应调节。",
    evidence:
      "光遗传操控提供任务内的因果证据；效果依赖是否接受消退训练及刺激类型，不能概括为抑制所有恐惧。",
    references: [
      {
        title:
          "Selective Control of Fear Expression by Optogenetic Manipulation of Infralimbic Cortex after Extinction",
        authors: "Kim HS, Cho HY, Augustine GJ, Han JH",
        year: 2016,
        journal: "Neuropsychopharmacology",
        url: "https://doi.org/10.1038/npp.2015.276",
        finding:
          "小鼠 ILA 兴奋性神经元的激活增强了消退后对条件性声音恐惧的抑制；在消退前未观察到相同效果。",
      },
      flexibleLearning,
    ],
  },
  {
    id: 382,
    acronym: "CA1",
    name: "海马 CA1 区",
    englishName: "Field CA1",
    category: "海马结构",
    color: "#7ED04B",
    summary:
      "CA1 是海马的一个分区。自由活动小鼠的长期钙成像发现，一部分 CA1 神经元在动物到达特定位置时活动，群体可在数周内保持可读出的空间表征。",
    function: "参与环境位置的群体编码。",
    evidence:
      "位置相关活动来自观察性成像研究。该结果不表示单个细胞永久对应一个位置，也不说明所有记忆都储存在 CA1。",
    references: [
      {
        title: "Long-term dynamics of CA1 hippocampal place codes",
        authors: "Ziv Y, Burns LD, Cocker ED, et al.",
        year: 2013,
        journal: "Nature Neuroscience",
        url: "https://doi.org/10.1038/nn.3329",
        finding:
          "连续追踪自由活动小鼠的 CA1 细胞，发现参与位置表征的细胞集合随时间变化，但跨日重叠细胞保留了稳定的位置场。",
      },
    ],
  },
  {
    id: 385,
    acronym: "VISp",
    name: "初级视觉皮层",
    englishName: "Primary visual area",
    category: "大脑皮层",
    color: "#08858C",
    summary:
      "VISp 通常对应实验文献中的 V1。它参与视觉信息处理，小鼠在判断图案方向或对比度是否改变时，会用到这里的神经活动。",
    function: "参与检测视觉刺激的方向与对比度变化。",
    evidence:
      "可逆光遗传抑制降低了特定视觉任务的表现，提供因果证据。研究没有证明一切视觉行为都必须经过 VISp。",
    references: [
      {
        title:
          "Mouse primary visual cortex is used to detect both orientation and contrast changes",
        authors: "Glickfeld LL, Histed MH, Maunsell JHR",
        year: 2013,
        journal: "Journal of Neuroscience",
        url: "https://doi.org/10.1523/JNEUROSCI.3560-13.2013",
        finding:
          "抑制小鼠 V1 提高了方向和对比度变化的检测阈值；行为影响与受抑制区域所对应的视野位置有关。",
      },
    ],
  },
  {
    id: 985,
    acronym: "MOp",
    name: "初级运动皮层",
    englishName: "Primary motor area",
    category: "大脑皮层",
    color: "#1F9D5A",
    summary:
      "MOp 是运动皮层的初级分区。小鼠学习前肢按杆动作时，这里的群体活动会随练习改变，逐渐形成更可重复的活动顺序。",
    function: "参与运动控制与习得动作的群体编码。",
    evidence:
      "长期钙成像显示活动模式与学习同步变化。这是群体活动的观察结果，不能据此把每个神经元解释为单一肌肉的开关。",
    references: [
      {
        title:
          "Emergence of reproducible spatiotemporal activity during motor learning",
        authors: "Peters AJ, Chen SX, Komiyama T",
        year: 2014,
        journal: "Nature",
        url: "https://doi.org/10.1038/nature13235",
        finding:
          "追踪小鼠运动皮层第 2/3 层神经元，发现前肢技能学习伴随兴奋性群体活动的重组与稳定。",
      },
    ],
  },
  {
    id: 322,
    acronym: "SSp",
    name: "初级躯体感觉皮层",
    englishName: "Primary somatosensory area",
    category: "大脑皮层",
    color: "#188064",
    summary:
      "SSp 包含对应不同身体部位的感觉分区。其中处理胡须触觉的桶状皮层，是研究小鼠如何主动探索物体的常用系统。",
    function: "处理身体感觉；胡须分区参与触碰检测与物体定位。",
    evidence:
      "所引操控实验针对胡须桶状皮层的第 4 层。结果支持该子区在主动触觉中的作用，不能直接外推到 SSp 的所有身体分区。",
    references: [
      {
        title:
          "Neural coding during active somatosensation revealed using illusory touch",
        authors: "O'Connor DH, Hires SA, Guo ZV, et al.",
        year: 2013,
        journal: "Nature Neuroscience",
        url: "https://doi.org/10.1038/nn.3419",
        finding:
          "在小鼠主动摆动胡须时，模拟单个皮层桶的触碰相关活动可影响物体位置判断；效果依赖合适的皮层桶与探索状态。",
      },
    ],
  },
  {
    id: 549,
    acronym: "TH",
    name: "丘脑",
    englishName: "Thalamus",
    category: "间脑",
    color: "#FF7080",
    summary:
      "丘脑由多个核团组成，各自具有不同的连接和功能。以内侧背核为例，小鼠实验发现它可以支持前额叶维持当前任务规则。",
    function: "不同核团参与感觉与皮层网络调节；内侧背核参与注意规则的维持。",
    evidence:
      "功能证据主要针对丘脑内侧背核。这里展示的是整个 TH，不能把该核团的结果归给每个丘脑细胞。",
    references: [thalamicAttention, atlasReferences[1]],
  },
  {
    id: 1097,
    acronym: "HY",
    name: "下丘脑",
    englishName: "Hypothalamus",
    category: "间脑",
    color: "#E64438",
    summary:
      "下丘脑包含参与身体状态与行为调节的不同核团。小鼠弓状核中的 AgRP 神经元是研究进食驱动的一个例子，激活它们可以在数分钟内诱发进食。",
    function: "通过特定核团与细胞群调节进食等身体状态相关行为。",
    evidence:
      "所引实验支持激活弓状核 AgRP 神经元足以诱发进食。它不等于整个下丘脑的功能，也没有直接测量小鼠的主观饥饿体验。",
    references: [
      {
        title:
          "AGRP neurons are sufficient to orchestrate feeding behavior rapidly and without training",
        authors: "Aponte Y, Atasoy D, Sternson SM",
        year: 2011,
        journal: "Nature Neuroscience",
        url: "https://doi.org/10.1038/nn.2739",
        finding:
          "细胞类型特异的光刺激表明，激活小鼠弓状核 AgRP 神经元可在无需预先训练的条件下迅速引发进食。",
      },
    ],
  },
  {
    id: 672,
    acronym: "CP",
    name: "尾状壳核",
    englishName: "Caudoputamen",
    category: "基底节",
    color: "#98D6F9",
    summary:
      "CP 是小鼠背侧纹状体的主要结构。动作开始前，直接与间接通路的投射神经元都可能出现活动增加，说明两条通路的工作方式比简单的动作开关更复杂。",
    function: "参与动作的启动与组织。",
    evidence:
      "研究记录了小鼠动作前的细胞群钙信号，支持两条通路的共同参与。活动先于动作不等于单独证明每条通路对该动作的必要性。",
    references: [
      {
        title:
          "Concurrent activation of striatal direct and indirect pathways during action initiation",
        authors: "Cui G, Jun SB, Jin X, et al.",
        year: 2013,
        journal: "Nature",
        url: "https://doi.org/10.1038/nature11846",
        finding:
          "在执行操作任务的小鼠背侧纹状体中，直接与间接通路的群体活动均在动作启动时增加，部分活动出现在对侧动作之前。",
      },
    ],
  },
  {
    id: 512,
    acronym: "CB",
    name: "小脑",
    englishName: "Cerebellum",
    category: "小脑",
    color: "#F0F080",
    summary:
      "小脑包含折叠的皮层和深部核团。清醒小鼠实验显示，改变局部浦肯野细胞的活动，能调节运动的幅度、速度和时序。",
    function: "参与运动参数的精细调节。",
    evidence:
      "局部光遗传操控提供运动调节的因果证据。此处整个小脑的高亮仅用于解剖定位，实验效应来自特定细胞与回路。",
    references: [
      {
        title:
          "Precise control of movement kinematics by optogenetic inhibition of Purkinje cell activity",
        authors: "Heiney SA, Kim J, Augustine GJ, Medina JF",
        year: 2014,
        journal: "Journal of Neuroscience",
        url: "https://doi.org/10.1523/JNEUROSCI.4547-13.2014",
        finding:
          "在清醒小鼠中短暂抑制浦肯野细胞可引发运动；抑制强度与持续时间能调节运动参数，并涉及深部小脑核的去抑制。",
      },
    ],
  },
  {
    id: 507,
    acronym: "MOB",
    name: "主嗅球",
    englishName: "Main olfactory bulb",
    category: "嗅觉系统",
    color: "#9AD2BD",
    summary:
      "主嗅球位于前脑前端，是气味信息处理的早期结构。清醒小鼠的成像显示，嗅小球与僧帽、簇状细胞对气味的响应稀疏且多样，输入与输出群体的气味表征并不相同。",
    function: "处理和重组气味相关神经活动。",
    evidence:
      "证据来自对气味诱发活动的观察与比较。嗅球里的空间位置不能直接读作固定的气味类别标签。",
    references: [
      {
        title:
          "Mosaic representations of odors in the input and output layers of the mouse olfactory bulb",
        authors: "Chae H, Kepple DR, Bast WG, et al.",
        year: 2019,
        journal: "Nature Neuroscience",
        url: "https://doi.org/10.1038/s41593-019-0442-z",
        finding:
          "比较清醒小鼠嗅球输入与输出的活动发现，两者的气味表征有所不同；常用理化描述符只能解释有限的神经响应差异。",
      },
    ],
  },
  {
    id: 295,
    acronym: "BLA",
    name: "基底外侧杏仁核",
    englishName: "Basolateral amygdalar nucleus",
    category: "杏仁核",
    color: "#9DE79C",
    summary:
      "BLA 是杏仁核的一部分，参与学习线索与结果的联系。小鼠研究发现，投向不同靶区的 BLA 神经元在奖赏与恐惧学习后表现出不同的突触变化。",
    function: "参与奖赏与厌恶相关联结的学习。",
    evidence:
      "通路特异的记录与光遗传操控支持不同投射群的功能差异。论文中 BLA 复合体的实验范围与 Allen 的单一标签并非必然完全重合。",
    references: [
      {
        title:
          "A circuit mechanism for differentiating positive and negative associations",
        authors: "Namburi P, Beyeler A, Yorozu S, et al.",
        year: 2015,
        journal: "Nature",
        url: "https://doi.org/10.1038/nature14366",
        finding:
          "BLA 投向伏隔核和杏仁中央内侧区的细胞群在学习后出现相反的突触变化；选择性刺激分别支持正性或负性强化。",
      },
    ],
  },
];

type RegionOutline = Omit<BrainRegion, "references" | "evidence">;

const additionalRegionOutlines: RegionOutline[] = [
  {
    id: 477,
    acronym: "STR",
    name: "纹状体",
    englishName: "Striatum",
    category: "基底节",
    color: "#98D6F9",
    summary:
      "STR 是 Allen 本体中的上级结构，包含背侧、腹侧及部分其他纹状体分区。它与列表中的 CP、ACB、LS 和 CEA 有层级重叠。",
    function: "观察纹状体各分区的整体关系。",
  },
  {
    id: 56,
    acronym: "ACB",
    name: "伏隔核",
    englishName: "Nucleus accumbens",
    category: "基底节",
    color: "#80CDF8",
    summary:
      "伏隔核位于腹侧纹状体。小鼠示踪研究显示，投向不同伏隔核分区的 VTA 多巴胺细胞具有不同的输入和输出分布。",
    function: "参与动机相关回路，是 VTA 多巴胺投射的靶区之一。",
  },
  {
    id: 1022,
    acronym: "GPe",
    name: "苍白球外侧部",
    englishName: "Globus pallidus, external segment",
    category: "基底节",
    color: "#8599CC",
    summary:
      "GPe 接收纹状体输出，并与其他基底节核团相连。小鼠连接研究显示，其内部存在多个不同的投射分区。",
    function: "参与纹状体间接通路及基底节信息传递。",
  },
  {
    id: 1031,
    acronym: "GPi",
    name: "苍白球内侧部",
    englishName: "Globus pallidus, internal segment",
    category: "基底节",
    color: "#8599CC",
    summary:
      "GPi 是 Allen 图谱中的苍白球内侧部标签。查看时可与 GPe 比较，二者是独立结构，名称中的内外不表示细胞类型相同。",
    function: "苍白球内侧部的解剖定位。",
  },
  {
    id: 470,
    acronym: "STN",
    name: "丘脑底核",
    englishName: "Subthalamic nucleus",
    category: "间脑",
    color: "#F2483B",
    summary:
      "STN 在功能回路中常与基底节一起讨论，Allen 解剖树将它置于下丘脑外侧区。小鼠切片实验研究了 GPe 抑制性输入与皮层兴奋性输入在此处的相互影响。",
    function: "整合基底节及皮层输入。",
  },
  {
    id: 362,
    acronym: "MD",
    name: "丘脑内侧背核",
    englishName: "Mediodorsal nucleus of thalamus",
    category: "间脑",
    color: "#FF909F",
    summary:
      "MD 是丘脑的一个核团。小鼠视听选择任务中，它支持前额叶保持与当前规则有关的活动。",
    function: "参与注意规则的维持。",
  },
  {
    id: 629,
    acronym: "VAL",
    name: "丘脑腹前外侧复合体",
    englishName: "Ventral anterior-lateral complex of the thalamus",
    category: "间脑",
    color: "#FF8084",
    summary:
      "VAL 是丘脑腹侧核群的一部分，属于 Allen 感觉运动相关丘脑结构。它与相邻的 VM 是不同标签。",
    function: "感觉运动相关丘脑核团的解剖定位。",
  },
  {
    id: 685,
    acronym: "VM",
    name: "丘脑腹内侧核",
    englishName: "Ventral medial nucleus of the thalamus",
    category: "间脑",
    color: "#FF8084",
    summary:
      "VM 位于丘脑腹侧核群。小鼠系统示踪研究将其分为若干接收基底节输出、连接皮层的投射分区。",
    function: "参与基底节与皮层之间的信息传递。",
  },
  {
    id: 149,
    acronym: "PVT",
    name: "丘脑室旁核",
    englishName: "Paraventricular nucleus of the thalamus",
    category: "间脑",
    color: "#FF909F",
    summary:
      "PVT 是丘脑中线核团，不要与下丘脑室旁核混淆。小鼠研究发现，PVT 到杏仁核中央外侧分区的投射参与恐惧学习。",
    function: "参与威胁相关学习的特定丘脑—杏仁核回路。",
  },
  {
    id: 181,
    acronym: "RE",
    name: "丘脑联合核",
    englishName: "Nucleus of reuniens",
    category: "间脑",
    color: "#FF909F",
    summary:
      "RE 位于丘脑中线核群。此条目展示 Allen 定义的联合核范围，便于和其他中线丘脑结构比较。",
    function: "中线丘脑核团的解剖定位。",
  },
  {
    id: 536,
    acronym: "CEA",
    name: "中央杏仁核",
    englishName: "Central amygdalar nucleus",
    category: "杏仁核",
    color: "#80C0E2",
    summary:
      "CEA 包含多个分区，与 BLA 是不同结构。小鼠研究显示，其特定细胞群接收 PVT 或 PB 输入，分别参与恐惧学习和进食抑制。",
    function: "参与威胁学习及身体状态相关的行为调节。",
  },
  {
    id: 351,
    acronym: "BST",
    name: "终纹床核",
    englishName: "Bed nuclei of the stria terminalis",
    category: "基底前脑",
    color: "#B3C0DF",
    summary:
      "BST 是一组包含多个分区的核团。小鼠通路操控发现，不同子区和投射可对回避、呼吸与强化产生不同影响。",
    function: "不同子回路调节焦虑相关行为与生理反应。",
  },
  {
    id: 726,
    acronym: "DG",
    name: "齿状回",
    englishName: "Dentate gyrus",
    category: "海马结构",
    color: "#7ED04B",
    summary:
      "DG 是海马结构的一部分，Allen 标签包括分子层、颗粒细胞层和多形层。小鼠遗传实验显示，颗粒细胞 NMDA 受体参与区分相似环境。",
    function: "参与相似情境的区分。",
  },
  {
    id: 463,
    acronym: "CA3",
    name: "海马 CA3 区",
    englishName: "Field CA3",
    category: "海马结构",
    color: "#7ED04B",
    summary:
      "CA3 是海马的一个分区。小鼠 CA3 特异的 NMDA 受体缺失会影响线索不完整时的空间记忆提取。",
    function: "参与根据部分线索提取联结记忆。",
  },
  {
    id: 909,
    acronym: "ENT",
    name: "内嗅区",
    englishName: "Entorhinal area",
    category: "海马结构",
    color: "#32B825",
    summary:
      "ENT 属于 Allen 海马旁区，包含外侧与内侧部分。小鼠内侧内嗅区的网格细胞会随虚拟空间中的位置呈现有规律的活动变化。",
    function: "内侧分区中的部分细胞参与空间位置编码。",
  },
  {
    id: 242,
    acronym: "LS",
    name: "外侧隔核",
    englishName: "Lateral septal nucleus",
    category: "基底前脑",
    color: "#90CBED",
    summary:
      "LS 是 Allen 隔核区的一个结构，包含背侧、中间和腹侧部分。它与同属前脑的纹状体、海马结构可在三切面中同时定位。",
    function: "外侧隔核各分区的解剖定位。",
  },
  {
    id: 313,
    acronym: "MB",
    name: "中脑",
    englishName: "Midbrain",
    category: "脑干·中脑",
    color: "#FF64FF",
    summary:
      "中脑是脑干的一个大区，含上丘、下丘、黑质和多个被盖核团。选中 MB 会同时覆盖列表中的多个中脑子结构。",
    function: "观察中脑感觉、运动及行为状态相关核团的整体关系。",
  },
  {
    id: 302,
    acronym: "SCs",
    name: "上丘感觉相关层",
    englishName: "Superior colliculus, sensory related",
    category: "脑干·中脑",
    color: "#FF7AFF",
    summary:
      "SCs 是 Allen 对上丘感觉相关部分的分组，包含浅层灰质和相关层次。它与更深部的 SCm 分开标注。",
    function: "上丘感觉相关层的解剖定位。",
  },
  {
    id: 294,
    acronym: "SCm",
    name: "上丘运动相关层",
    englishName: "Superior colliculus, motor related",
    category: "脑干·中脑",
    color: "#FF90FF",
    summary:
      "SCm 包括上丘中间及深层。小鼠实验发现，内侧上丘深层的兴奋性细胞向背侧 PAG 传递威胁相关信号。",
    function: "特定子回路参与逃逸决策。",
  },
  {
    id: 4,
    acronym: "IC",
    name: "下丘",
    englishName: "Inferior colliculus",
    category: "脑干·中脑",
    color: "#FF7AFF",
    summary:
      "下丘属于 Allen 中脑感觉相关结构，包含中央核、背侧核和外侧核。这里选择的是三个分区共同的上级标签。",
    function: "听觉相关中脑结构的解剖定位。",
  },
  {
    id: 795,
    acronym: "PAG",
    name: "导水管周围灰质",
    englishName: "Periaqueductal gray",
    category: "脑干·中脑",
    color: "#FF90FF",
    summary:
      "PAG 位于中脑导水管周围。小鼠背侧 PAG 的谷氨酸能细胞活动与是否逃逸及逃逸强度有关。",
    function: "特定细胞群参与防御性逃逸。",
  },
  {
    id: 374,
    acronym: "SNc",
    name: "黑质致密部",
    englishName: "Substantia nigra, compact part",
    category: "脑干·中脑",
    color: "#FFA6FF",
    summary:
      "SNc 与黑质网状部是不同结构。小鼠全脑示踪与记录显示，投向不同背侧纹状体分区的 SNc 多巴胺细胞具有不同连接和信号特征。",
    function: "通过不同多巴胺子回路调节背侧纹状体。",
  },
  {
    id: 381,
    acronym: "SNr",
    name: "黑质网状部",
    englishName: "Substantia nigra, reticular part",
    category: "脑干·中脑",
    color: "#FF90FF",
    summary:
      "SNr 是基底节输出的靶点和中继结构之一。小鼠实验与系统示踪表明，纹状体不同输出分支可汇聚到这里。",
    function: "整合纹状体相关输出，并连接丘脑等下游结构。",
  },
  {
    id: 749,
    acronym: "VTA",
    name: "腹侧被盖区",
    englishName: "Ventral tegmental area",
    category: "脑干·中脑",
    color: "#FF90FF",
    summary:
      "VTA 包含多种细胞类型。小鼠细胞类型特异示踪发现，多巴胺细胞按投射靶区形成不同的输入—输出关系。",
    function: "参与动机相关调节，向伏隔核和前额叶等区域投射。",
  },
  {
    id: 128,
    acronym: "MRN",
    name: "中脑网状核",
    englishName: "Midbrain reticular nucleus",
    category: "脑干·中脑",
    color: "#FF90FF",
    summary:
      "MRN 在 Allen 中指 Midbrain reticular nucleus，位于中脑运动相关组。不要将这个缩写误解为其他文献中的正中缝核。",
    function: "中脑网状结构的解剖定位。",
  },
  {
    id: 214,
    acronym: "RN",
    name: "红核",
    englishName: "Red nucleus",
    category: "脑干·中脑",
    color: "#FF90FF",
    summary:
      "红核是 Allen 中脑运动相关组中的独立核团。三维视图可用于区分它与邻近的中脑网状核及黑质。",
    function: "运动相关中脑核团的解剖定位。",
  },
  {
    id: 872,
    acronym: "DR",
    name: "背侧缝核",
    englishName: "Dorsal nucleus raphe",
    category: "脑干·中脑",
    color: "#FFA6FF",
    summary:
      "DR 是中脑缝核群的一部分，内含不同细胞类型。小鼠记录发现，部分血清素细胞在等待和获得奖赏时活动增加。",
    function: "特定细胞群参与奖赏等待与获得的表征。",
  },
  {
    id: 100,
    acronym: "IPN",
    name: "脚间核",
    englishName: "Interpeduncular nucleus",
    category: "脑干·中脑",
    color: "#FFA6FF",
    summary:
      "IPN 属于 Allen 中脑行为状态相关组，包含多个子核。此标签用于查看脚间核整体，不能把它当作单一细胞群。",
    function: "脚间核及其子核的解剖定位。",
  },
  {
    id: 771,
    acronym: "P",
    name: "脑桥",
    englishName: "Pons",
    category: "脑干·脑桥",
    color: "#FF9B88",
    summary:
      "脑桥是后脑的一部分，包含感觉、运动与行为状态相关的多个核团。选中 P 会覆盖 LC、PB 等已单独列出的结构。",
    function: "观察脑桥核团与中脑、延髓的空间关系。",
  },
  {
    id: 147,
    acronym: "LC",
    name: "蓝斑",
    englishName: "Locus ceruleus",
    category: "脑干·脑桥",
    color: "#FFC395",
    summary:
      "LC 是脑桥中的小核团。小鼠光遗传研究显示，操控其中去甲肾上腺素细胞的活动能够改变睡眠与觉醒转换。",
    function: "参与觉醒状态的调节。",
  },
  {
    id: 867,
    acronym: "PB",
    name: "臂旁核",
    englishName: "Parabrachial nucleus",
    category: "脑干·脑桥",
    color: "#FFAE6F",
    summary:
      "PB 包含外侧和内侧分区。小鼠外侧 PB 的 CGRP 细胞接收特定 NTS 输入，并向中央杏仁核投射，参与不宜进食时的食欲抑制。",
    function: "特定细胞群参与身体状态信号与进食抑制。",
  },
  {
    id: 1052,
    acronym: "PPN",
    name: "脚桥核",
    englishName: "Pedunculopontine nucleus",
    category: "脑干·中脑",
    color: "#FFA6FF",
    summary:
      "PPN 位于中脑与脑桥交界相关区域，Allen 将它归入中脑。小鼠谷氨酸能 PPN 细胞的操控支持其参与较慢的交替步态运动。",
    function: "特定兴奋性细胞群参与运动速度与步态调节。",
  },
  {
    id: 1093,
    acronym: "PRNc",
    name: "脑桥尾侧网状核",
    englishName: "Pontine reticular nucleus, caudal part",
    category: "脑干·脑桥",
    color: "#FFBA86",
    summary:
      "PRNc 是脑桥网状结构的尾侧部分，Allen 将它归入脑桥运动相关组。它与 PRNr 是两个独立标注。",
    function: "脑桥尾侧运动相关网状结构的定位。",
  },
  {
    id: 146,
    acronym: "PRNr",
    name: "脑桥网状核",
    englishName: "Pontine reticular nucleus",
    category: "脑干·脑桥",
    color: "#FFC395",
    summary:
      "Allen 对 PRNr 的官方名称是 Pontine reticular nucleus。这里沿用该名称，避免将其与尾侧部 PRNc 合并或误标。",
    function: "脑桥网状核的解剖定位。",
  },
  {
    id: 162,
    acronym: "LDT",
    name: "背外侧被盖核",
    englishName: "Laterodorsal tegmental nucleus",
    category: "脑干·脑桥",
    color: "#FFC395",
    summary:
      "LDT 属于 Allen 脑桥行为状态相关组。它与 PPN 是不同标签，二者不应仅因文献中常一起讨论而合并。",
    function: "脑桥被盖区核团的解剖定位。",
  },
  {
    id: 354,
    acronym: "MY",
    name: "延髓",
    englishName: "Medulla",
    category: "脑干·延髓",
    color: "#FF9BCD",
    summary:
      "延髓是后脑的一个大区，包含孤束核、脑神经运动核团和前庭核群等。选中 MY 会覆盖多个已单独列出的延髓结构。",
    function: "观察延髓感觉与运动核团的整体关系。",
  },
  {
    id: 651,
    acronym: "NTS",
    name: "孤束核",
    englishName: "Nucleus of the solitary tract",
    category: "脑干·延髓",
    color: "#FFA5D2",
    summary:
      "NTS 是延髓感觉相关核团。小鼠研究辨认出两类向 PB 的 CGRP 细胞提供直接兴奋性输入的 NTS 细胞。",
    function: "特定细胞群传递身体状态相关信号并抑制进食。",
  },
  {
    id: 839,
    acronym: "DMX",
    name: "迷走神经背侧运动核",
    englishName: "Dorsal motor nucleus of the vagus nerve",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "DMX 是 Allen 延髓运动相关组中的脑神经核团。它与旁边负责感觉处理的 NTS 是不同结构。",
    function: "迷走神经运动核团的解剖定位。",
  },
  {
    id: 773,
    acronym: "XII",
    name: "舌下神经核",
    englishName: "Hypoglossal nucleus",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "XII 是舌下神经对应的延髓核团，属于 Allen 延髓运动相关组。该三维边界用于解剖定位，不显示单个运动神经元。",
    function: "舌下神经运动核团的解剖定位。",
  },
  {
    id: 83,
    acronym: "IO",
    name: "下橄榄复合体",
    englishName: "Inferior olivary complex",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "IO 是延髓中的复合核团，其攀缘纤维投向小脑皮层。小鼠实验显示，攀缘纤维信号在所测眨眼条件学习中具有必要作用。",
    function: "通过攀缘纤维参与小脑联结学习。",
  },
  {
    id: 1048,
    acronym: "GRN",
    name: "巨细胞网状核",
    englishName: "Gigantocellular reticular nucleus",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "GRN 是 Allen 延髓运动相关组中的网状核团。它不是整个延髓网状结构的总称。",
    function: "延髓运动相关网状核团的解剖定位。",
  },
  {
    id: 661,
    acronym: "VII",
    name: "面神经运动核",
    englishName: "Facial motor nucleus",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "VII 是 Allen 延髓中的面神经运动核标签。它与脑桥中的三叉神经运动核 V 是不同结构。",
    function: "面神经运动核团的解剖定位。",
  },
  {
    id: 621,
    acronym: "V",
    name: "三叉神经运动核",
    englishName: "Motor nucleus of trigeminal",
    category: "脑干·脑桥",
    color: "#FFBA86",
    summary:
      "V 在此处指三叉神经运动核，Allen 将其归入脑桥。该标签不包含所有三叉神经感觉核团。",
    function: "三叉神经运动核团的解剖定位。",
  },
  {
    id: 202,
    acronym: "MV",
    name: "内侧前庭核",
    englishName: "Medial vestibular nucleus",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "MV 是 Allen 前庭核群中的内侧核。它与外侧、上前庭核和脊髓前庭核分别标注。",
    function: "前庭核群内侧分区的解剖定位。",
  },
  {
    id: 209,
    acronym: "LAV",
    name: "外侧前庭核",
    englishName: "Lateral vestibular nucleus",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "LAV 是 Allen 前庭核群中的外侧核。可结合 MV、SUV 和 SPIV 查看同一核群的空间分区。",
    function: "前庭核群外侧分区的解剖定位。",
  },
  {
    id: 217,
    acronym: "SUV",
    name: "上前庭核",
    englishName: "Superior vestibular nucleus",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "SUV 是 Allen 前庭核群中的上前庭核。标签用于描述参考脑中的解剖范围，不能据此划分每个细胞的功能。",
    function: "前庭核群上部分区的解剖定位。",
  },
  {
    id: 225,
    acronym: "SPIV",
    name: "脊髓前庭核",
    englishName: "Spinal vestibular nucleus",
    category: "脑干·延髓",
    color: "#FFB3D9",
    summary:
      "SPIV 是 Allen 前庭核群中的独立核团。其英文名称为 Spinal vestibular nucleus，不应误解成一段脊髓。",
    function: "前庭核群尾侧相关分区的解剖定位。",
  },
  {
    id: 607,
    acronym: "CN",
    name: "耳蜗核群",
    englishName: "Cochlear nuclei",
    category: "脑干·延髓",
    color: "#FFA5D2",
    summary:
      "CN 是耳蜗核群的上级结构，Allen 将它归入延髓感觉相关组。显示范围包含背侧及腹侧耳蜗核等子结构。",
    function: "听觉相关延髓核团的解剖定位。",
  },
  {
    id: 398,
    acronym: "SOC",
    name: "上橄榄复合体",
    englishName: "Superior olivary complex",
    category: "脑干·脑桥",
    color: "#FFAE6F",
    summary:
      "SOC 是脑桥感觉相关结构，包含内侧、外侧及其他上橄榄分区。它与延髓中的下橄榄复合体 IO 是不同系统的结构。",
    function: "听觉相关脑桥结构的解剖定位。",
  },
  {
    id: 612,
    acronym: "NLL",
    name: "外侧丘系核",
    englishName: "Nucleus of the lateral lemniscus",
    category: "脑干·脑桥",
    color: "#FFAE6F",
    summary:
      "NLL 是 Allen 脑桥感觉相关组中的核团，含背、中间与腹侧部分。不要把该核团标签与外侧丘系纤维束本身混淆。",
    function: "听觉相关脑桥核团的解剖定位。",
  },
  {
    id: 1002,
    acronym: "AUDp",
    name: "初级听觉皮层",
    englishName: "Primary auditory area",
    category: "大脑皮层",
    color: "#019399",
    summary:
      "AUDp 是 Allen 听觉皮层的初级分区，包含不同皮层层次。三维选择使用各层的合并边界。",
    function: "初级听觉皮层及其分层的解剖定位。",
  },
  {
    id: 194,
    acronym: "LHA",
    name: "下丘脑外侧区",
    englishName: "Lateral hypothalamic area",
    category: "间脑",
    color: "#F2483B",
    summary:
      "LHA 是下丘脑外侧区中的一个解剖标签。小鼠研究显示，部分 GABA 细胞参与获取食物的行动，另一些细胞更多在摄食时活动。",
    function: "特定细胞群参与食物寻求与摄食。",
  },
  {
    id: 797,
    acronym: "ZI",
    name: "未定带",
    englishName: "Zona incerta",
    category: "间脑",
    color: "#F2483B",
    summary:
      "ZI 属于 Allen 下丘脑外侧区，与 STN 分别标注。小鼠实验发现，激活部分 ZI 的 GABA 细胞或其到 PVT 的轴突可迅速增加进食。",
    function: "特定抑制性细胞群参与进食驱动。",
  },
];

export const circuitReferences = {
  basal: {
    title:
      "Regulation of parkinsonian motor behaviours by optogenetic control of basal ganglia circuitry",
    authors: "Kravitz AV, Freeze BS, Parker PRL, et al.",
    year: 2010,
    journal: "Nature",
    url: "https://doi.org/10.1038/nature09159",
    finding:
      "小鼠纹状体直接与间接通路细胞的光遗传刺激对运动产生不同影响；实验操控不等于自然行为中两群细胞始终互斥。",
  },
  basalMap: {
    title: "The mouse cortico–basal ganglia–thalamic network",
    authors: "Foster NN, Barry J, Korobkova L, et al.",
    year: 2021,
    journal: "Nature",
    url: "https://doi.org/10.1038/s41586-021-03993-3",
    finding:
      "系统小鼠示踪描绘纹状体经 GPe、SNr、丘脑到皮层的分区连接，并发现直接与间接输出可汇聚到共同 SNr 细胞。",
  },
  pallidal: {
    title:
      "Heterosynaptic regulation of external globus pallidus inputs to the subthalamic nucleus by the motor cortex",
    authors: "Chu HY, Atherton JF, Wokosin D, Surmeier DJ, Bevan MD",
    year: 2015,
    journal: "Neuron",
    url: "https://doi.org/10.1016/j.neuron.2014.12.022",
    finding: "小鼠切片实验研究皮层兴奋性输入对 GPe 到 STN 抑制性突触的调节。",
  },
  dopamine: {
    title:
      "Circuit Architecture of VTA Dopamine Neurons Revealed by Systematic Input-Output Mapping",
    authors: "Beier KT, Steinberg EE, DeLoach KE, et al.",
    year: 2015,
    journal: "Cell",
    url: "https://doi.org/10.1016/j.cell.2015.07.015",
    finding:
      "小鼠细胞类型与投射靶向示踪揭示 VTA 多巴胺回路，包括背侧缝核输入及不同伏隔核分区输出；部分新通路得到电生理验证。",
  },
  escape: {
    title: "A synaptic threshold mechanism for computing escape decisions",
    authors: "Evans DA, Stempel AV, Vale R, et al.",
    year: 2018,
    journal: "Nature",
    url: "https://doi.org/10.1038/s41586-018-0244-6",
    finding:
      "小鼠内侧上丘深层向背侧 PAG 提供单突触兴奋性输入；记录和操控将此连接与逃逸阈值联系起来。",
  },
  nts: {
    title:
      "Genetically and functionally defined NTS to PBN brain circuits mediating anorexia",
    authors: "Roman CW, Derkach VA, Palmiter RD",
    year: 2016,
    journal: "Nature Communications",
    url: "https://doi.org/10.1038/ncomms11905",
    finding:
      "小鼠 NTS 的 CCK 与 DBH 细胞群直接兴奋 PB 的 CGRP 细胞；激活相关细胞或通路减少进食。",
  },
  appetite: {
    title:
      "Genetic identification of a neural circuit that suppresses appetite",
    authors: "Carter ME, Soden ME, Zweifel LS, Palmiter RD",
    year: 2013,
    journal: "Nature",
    url: "https://doi.org/10.1038/nature12596",
    finding:
      "小鼠外侧 PB 的 CGRP 细胞向中央杏仁核投射；该细胞群及其投射的操控支持它们参与食欲抑制。",
  },
} satisfies Record<string, BrainReference>;

const additionalReferences = {
  snc: {
    title:
      "Intact-Brain Analyses Reveal Distinct Information Carried by SNc Dopamine Subcircuits",
    authors: "Lerner TN, Shilyansky C, Davidson TJ, et al.",
    year: 2015,
    journal: "Cell",
    url: "https://doi.org/10.1016/j.cell.2015.07.014",
    finding:
      "小鼠示踪、完整脑成像和活动记录发现，投向背内侧与背外侧纹状体的 SNc 多巴胺细胞构成可区分的子回路。",
  },
  ent: {
    title: "Membrane potential dynamics of grid cells",
    authors: "Domnisoru C, Kinkhabwala AA, Tank DW",
    year: 2013,
    journal: "Nature",
    url: "https://doi.org/10.1038/nature11973",
    finding:
      "在虚拟轨道运动的小鼠中记录内侧内嗅区网格细胞膜电位，发现位置相关放电与缓慢去极化及 theta 振荡有关。",
  },
  io: {
    title:
      "Climbing fibers provide essential instructive signals for associative learning",
    authors: "Silva NT, Ramírez-Buriticá J, Pritchett DL, Carey MR",
    year: 2024,
    journal: "Nature Neuroscience",
    url: "https://doi.org/10.1038/s41593-024-01594-7",
    finding:
      "小鼠眨眼条件学习中，细胞类型特异操控支持下橄榄来源的攀缘纤维及其诱发的复杂尖峰提供学习所需信号。",
  },
  lha: {
    title:
      "Visualizing hypothalamic network dynamics for appetitive and consummatory behaviors",
    authors: "Jennings JH, Ung RL, Resendez SL, et al.",
    year: 2015,
    journal: "Cell",
    url: "https://doi.org/10.1016/j.cell.2014.12.026",
    finding:
      "自由活动小鼠的细胞记录和操控表明，外侧下丘脑不同 GABA 细胞群参与食物寻求或摄食过程。",
  },
  zi: {
    title:
      "Rapid binge-like eating and body weight gain driven by zona incerta GABA neuron activation",
    authors: "Zhang X, van den Pol AN",
    year: 2017,
    journal: "Science",
    url: "https://doi.org/10.1126/science.aam7100",
    finding:
      "小鼠 ZI 的 GABA 细胞或其到 PVT 的末梢被光刺激后进食增加；反复刺激可增加体重。",
  },
  lc: {
    title:
      "Tuning arousal with optogenetic modulation of locus coeruleus neurons",
    authors: "Carter ME, Yizhar O, Chikahisa S, et al.",
    year: 2010,
    journal: "Nature Neuroscience",
    url: "https://doi.org/10.1038/nn.2682",
    finding:
      "小鼠蓝斑去甲肾上腺素细胞的光遗传操控改变睡眠与觉醒转换；效应依赖刺激频率和持续时间。",
  },
  dr: {
    title:
      "Serotonin neurons in the dorsal raphe nucleus encode reward signals",
    authors: "Li Y, Zhong W, Wang D, et al.",
    year: 2016,
    journal: "Nature Communications",
    url: "https://doi.org/10.1038/ncomms10503",
    finding:
      "自由活动小鼠的细胞群钙信号和单细胞记录显示，部分背侧缝核血清素细胞在等待与获得奖赏时活动。",
  },
  ppn: {
    title: "Midbrain circuits that set locomotor speed and gait selection",
    authors: "Caggiano V, Leiras R, Goñi-Erro H, et al.",
    year: 2018,
    journal: "Nature",
    url: "https://doi.org/10.1038/nature25448",
    finding:
      "小鼠 PPN 与楔形核中的谷氨酸能细胞支持不同速度和步态；PPN 的实验效应以较慢交替步态为主。",
  },
  pvt: {
    title:
      "The paraventricular thalamus controls a central amygdala fear circuit",
    authors: "Penzo MA, Robert V, Tucciarone J, et al.",
    year: 2015,
    journal: "Nature",
    url: "https://doi.org/10.1038/nature13978",
    finding:
      "小鼠 PVT 到中央杏仁核外侧分区的输入参与恐惧学习，研究辨认出 BDNF/TrkB 相关的细胞与突触机制。",
  },
  bst: {
    title:
      "Diverging neural pathways assemble a behavioural state from separable features in anxiety",
    authors: "Kim SY, Adhikari A, Lee SY, et al.",
    year: 2013,
    journal: "Nature",
    url: "https://doi.org/10.1038/nature12018",
    finding:
      "小鼠 BST 不同子区与输出投射对焦虑相关的回避、呼吸和强化有不同作用。",
  },
  dg: {
    title:
      "Dentate gyrus NMDA receptors mediate rapid pattern separation in the hippocampal network",
    authors: "McHugh TJ, Jones MW, Quinn JJ, et al.",
    year: 2007,
    journal: "Science",
    url: "https://doi.org/10.1126/science.1140263",
    finding:
      "小鼠齿状回颗粒细胞 NMDA 受体缺失损害相似情境的区分，并影响海马网络的模式分离。",
  },
  ca3: {
    title:
      "Requirement for hippocampal CA3 NMDA receptors in associative memory recall",
    authors: "Nakazawa K, Quirk MC, Chitwood RA, et al.",
    year: 2002,
    journal: "Science",
    url: "https://doi.org/10.1126/science.1071795",
    finding:
      "成年小鼠 CA3 特异 NMDA 受体缺失后，完整线索下的表现保留，但部分线索下的空间记忆提取受损。",
  },
} satisfies Record<string, BrainReference>;

type RegionEvidence = Pick<BrainRegion, "evidence" | "references">;
const functionalEvidence: Partial<Record<number, RegionEvidence>> = {
  374: {
    evidence:
      "研究按投射靶点定义多巴胺细胞群，不代表所有 SNc 细胞拥有相同信号；Allen 解剖标签不等于多巴胺细胞掩膜。",
    references: [additionalReferences.snc],
  },
  909: {
    evidence:
      "电生理证据针对内侧内嗅区中的网格细胞，不能外推为整个 ENT 或其中所有细胞的统一功能。",
    references: [additionalReferences.ent],
  },
  83: {
    evidence:
      "因果证据限于所研究的眨眼条件学习及相关攀缘纤维；整块 IO 的高亮不代表全部细胞均接受同样操控。",
    references: [additionalReferences.io],
  },
  194: {
    evidence:
      "记录和细胞群操控支持食物相关作用。论文 LH 的实验范围与 Allen LHA 边界不必完全重合，且该区包含多种细胞类型。",
    references: [additionalReferences.lha],
  },
  797: {
    evidence:
      "光遗传实验表明特定细胞群的激活足以驱动进食，不意味着全部未定带细胞都具有该功能，也不直接对应人类进食障碍。",
    references: [additionalReferences.zi],
  },
  56: {
    evidence:
      "细胞类型特异示踪提供投射证据；伏隔核不同分区和细胞群不能视为同一个奖赏信号。",
    references: [circuitReferences.dopamine],
  },
  1022: {
    evidence:
      "依据小鼠系统连接图谱与通路操控。GPe 的不同细胞群具有不同靶点，不能用单一运动抑制作用概括。",
    references: [circuitReferences.basalMap, circuitReferences.basal],
  },
  470: {
    evidence:
      "所引原始研究针对小鼠切片中的输入突触调节，不直接证明所有 STN 活动都抑制运动。",
    references: [circuitReferences.pallidal],
  },
  362: {
    evidence:
      "记录与通路操控支持此任务中的因果作用，不能据此把整个 MD 定义为单一注意中心。",
    references: [thalamicAttention],
  },
  685: {
    evidence:
      "证据主要是解剖示踪和所测连接的电生理验证；图谱的 VM 整体边界不等同于论文的单一投射分区。",
    references: [circuitReferences.basalMap],
  },
  149: {
    evidence:
      "原始实验操控的是到中央杏仁核特定分区的投射，不代表全部 PVT 细胞都执行同一功能。",
    references: [additionalReferences.pvt],
  },
  536: {
    evidence:
      "这里高亮整个 CEA；所引研究集中在特定外侧分区和细胞群，不能将所有效应归给完整结构。",
    references: [additionalReferences.pvt, circuitReferences.appetite],
  },
  351: {
    evidence:
      "因果证据来自小鼠特定子区与投射操控。BST 不是对所有焦虑成分作用一致的单一核团。",
    references: [additionalReferences.bst],
  },
  726: {
    evidence:
      "结果来自颗粒细胞受体的遗传操控，支持特定学习条件下的机制，不等于所有齿状回细胞只负责模式分离。",
    references: [additionalReferences.dg],
  },
  463: {
    evidence:
      "结果来自 CA3 细胞受体的条件性遗传缺失，作用与线索完整程度有关；不能把 CA3 当作所有记忆的独立存储器。",
    references: [additionalReferences.ca3],
  },
  294: {
    evidence:
      "论文中的内侧上丘深层是 SCm 内的特定实验区域；整块 SCm 的高亮只作解剖定位。",
    references: [circuitReferences.escape],
  },
  795: {
    evidence:
      "记录与操控集中在背侧 PAG 的兴奋性细胞，不能外推到 PAG 所有柱状分区及细胞类型。",
    references: [circuitReferences.escape],
  },
  381: {
    evidence:
      "小鼠连接与操控研究支持基底节输出功能；SNr 内部存在投射分区与异质性。",
    references: [circuitReferences.basalMap, circuitReferences.basal],
  },
  749: {
    evidence:
      "示踪分辨不同投射细胞群，部分通路有电生理及行为验证。VTA 整体不等同于多巴胺细胞，也不能全部归为奖赏。",
    references: [circuitReferences.dopamine],
  },
  872: {
    evidence:
      "文案对应特定小鼠任务中的记录结果，不等于全部背侧缝核活动只编码奖赏；该区同时含其他细胞类型。",
    references: [additionalReferences.dr],
  },
  147: {
    evidence:
      "功能依据细胞类型特异的光遗传实验。LC 体积小，当前参考体素与表面网格只能展示近似边界，不能用于细胞计数。",
    references: [additionalReferences.lc],
  },
  867: {
    evidence:
      "所引实验针对外侧 PB 的 CGRP 细胞及其连接，不能把整块 PB 的所有功能概括为食欲抑制。",
    references: [circuitReferences.nts, circuitReferences.appetite],
  },
  1052: {
    evidence:
      "实验针对 PPN 谷氨酸能细胞，不能外推给全部 PPN 神经元或把它等同于单一胆碱能核团。",
    references: [additionalReferences.ppn],
  },
  651: {
    evidence:
      "细胞类型及通路操控支持进食相关作用，但 NTS 含多种细胞和子核，图中高亮范围大于实验细胞群。",
    references: [circuitReferences.nts],
  },
};

export const brainRegions: BrainRegion[] = [
  ...coreBrainRegions,
  ...corticalRegionOutlines.map((region): BrainRegion => ({
    ...region,
    evidenceScope: "anatomy",
    summary: "采用 Allen CCFv3 2017 官方脑区表面，包含本体中属于该区的已标注下级分区。英文名称、缩写和结构编号保留官方定义。",
    function: "用于查看这一结构的位置、范围及其与邻近脑区的关系。此条目未收录特定功能实验。",
    evidence: "依据 Allen 解剖本体和官方 CCFv3 表面。解剖标签支持命名与定位，不证明独立的行为功能；未标注到细分区域的体素不会被推定归属。",
    references: [atlasReferences[0], {
      title: "Allen Mouse Brain Atlas structure ontology · graph 1",
      authors: "Allen Institute for Brain Science",
      year: 2026,
      journal: "Allen structure graph 1 · API checked 2026-10-03",
      url: "https://api.brain-map.org/api/v2/structure_graph_download/1.json",
      finding: "以官方结构 ID 对照英文名称、缩写、颜色及祖先层级。中文名称仅作显示译名，英文名称与 ID 用于核对来源。",
    }],
  })),
  ...additionalRegionOutlines.map((region): BrainRegion => ({
    ...region,
    evidence:
      "本条依据 Allen 解剖本体与 CCFv3 分区。所引图谱支持结构命名和定位；此处未加入该核团的特定功能实验，不把解剖边界等同于功能或细胞类型边界。",
    references: [atlasReferences[0]],
    ...functionalEvidence[region.id],
  })),
];
