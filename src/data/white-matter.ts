import type { AtlasData } from "../lib/atlas";
import {
  isWhiteMatterStructure,
  WHITE_MATTER_COLOR,
} from "../lib/white-matter";
import type { BrainReference, BrainRegion } from "./regions";

const atlasKim: BrainReference = {
  title: "Enhanced and unified anatomical labeling for a common mouse brain atlas",
  authors: "Chon U, Vanselow DJ, Cheng KC, et al.",
  year: 2019,
  journal: "Nature Communications",
  url: "https://doi.org/10.1038/s41467-019-13057-w",
  finding:
    "在 Allen CCF 空间给出基于 Paxinos–Franklin 分区的三维标注，本页白质边界即来自其 v2 数据。该工作只提供解剖分区，不测量任何通路功能。",
};

const connectome: BrainReference = {
  title: "A mesoscale connectome of the mouse brain",
  authors: "Oh SW, Harris JA, Ng L, et al.",
  year: 2014,
  journal: "Nature",
  url: "https://doi.org/10.1038/nature13186",
  finding:
    "用病毒示踪与全脑成像建立小鼠介观连接图谱，可佐证白质通路两端脑区之间的轴突投射。投射强度是解剖测量，不直接证明行为功能。",
};

const dulac: BrainReference = {
  title:
    "Molecular detection of pheromone signals in mammals: from genes to behaviour",
  authors: "Dulac C, Torello AT",
  year: 2003,
  journal: "Nature Reviews Neuroscience",
  url: "https://doi.org/10.1038/nrn1140",
  finding:
    "综述犁鼻器感受神经元经犁鼻神经把化学信号传入副嗅球的分子与解剖基础，并讨论其与先天社会行为的关系。行为层面的因果链主要来自受体与神经元的功能研究，而非神经干本身的记录。",
};

const mombaerts: BrainReference = {
  title: "Axonal Wiring in the Mouse Olfactory System",
  authors: "Mombaerts P",
  year: 2006,
  journal: "Annual Review of Cell and Developmental Biology",
  url: "https://doi.org/10.1146/annurev.cellbio.21.012804.093915",
  finding:
    "总结小鼠嗅上皮感觉神经元的轴突（嗅神经）如何按受体类型汇聚到嗅球特定嗅小球的遗传与发育证据，提供嗅神经层的连接与发育背景。",
};

const igarashi: BrainReference = {
  title:
    "Parallel mitral and tufted cell pathways route distinct odor information to different targets in the olfactory cortex",
  authors: "Igarashi KM, Ieki N, An M, et al.",
  year: 2012,
  journal: "Journal of Neuroscience",
  url: "https://doi.org/10.1523/JNEUROSCI.0154-12.2012",
  finding:
    "在小鼠中比较僧帽细胞与簇状细胞的单细胞投射和气味反应：簇状细胞主要投向嗅皮层前部，僧帽细胞的靶区分布更广。研究未把前连合列为簇状细胞的投射靶区，也未测定 Kim 图谱中背侧外侧嗅束的细胞组成。",
};

const anteriorCommissure: BrainReference = {
  title: "The mouse olfactory peduncle. 2. The anterior limb of the anterior commissure",
  authors: "Brunjes PC",
  year: 2013,
  journal: "Frontiers in Neuroanatomy",
  url: "https://doi.org/10.3389/fnana.2012.00051",
  finding:
    "小鼠嗅脚的解剖研究描述前连合前肢的走行及纤维组成。它支持该段作为嗅觉相关跨半球通路的定位，不证明某一簇状细胞群以此为末梢靶点。",
};

const petros: BrainReference = {
  title: "Retinal axon growth at the optic chiasm: to cross or not to cross",
  authors: "Petros TJ, Rebsam A, Mason CA",
  year: 2008,
  journal: "Annual Review of Neuroscience",
  url: "https://doi.org/10.1146/annurev.neuro.31.060407.125609",
  finding:
    "综述小鼠视交叉处视网膜轴突交叉与否的分子决定机制；小鼠大部分视网膜纤维在视交叉跨过中线，形成以对侧为主的视觉输入。",
};

const dhande: BrainReference = {
  title:
    "Retinal ganglion cell maps in the brain: implications for visual processing",
  authors: "Dhande OS, Huberman AD",
  year: 2014,
  journal: "Current Opinion in Neurobiology",
  url: "https://doi.org/10.1016/j.conb.2013.08.006",
  finding:
    "综述小鼠不同类型视网膜神经节细胞的轴突经视神经、视束和上丘臂分别投向背外侧膝状体与上丘等靶区，支撑视束与上丘臂携带不同视觉信息流。",
};

const ito: BrainReference = {
  title:
    "The Mouse Superior Colliculus: An Emerging Model for Studying Circuit Formation and Function",
  authors: "Ito S, Feldheim DA",
  year: 2018,
  journal: "Frontiers in Neural Circuits",
  url: "https://doi.org/10.3389/fncir.2018.00010",
  finding:
    "综述小鼠上丘的分层、视网膜输入与两侧上丘间连合联系，说明上丘白层是跨层与下行输出的纤维所在，而非独立核团。",
};

const dean: BrainReference = {
  title:
    "Event or emergency? Two response systems in the mammalian superior colliculus",
  authors: "Dean P, Redgrave P, Westby GW",
  year: 1989,
  journal: "Trends in Neurosciences",
  url: "https://doi.org/10.1016/0166-2236(89)90052-0",
  finding:
    "提出上丘浅层偏向感觉分析、深层（含中、深白层）偏向触发趋近或防御反应的框架；该框架来自哺乳动物电生理与损毁研究，不是对单层纤维束的直接记录。",
};

const evans: BrainReference = {
  title: "A synaptic threshold mechanism for computing escape decisions",
  authors: "Evans DA, Stempel AV, Vale R, et al.",
  year: 2018,
  journal: "Nature",
  url: "https://doi.org/10.1038/s41586-018-0244-6",
  finding:
    "在小鼠中证明上丘深层网络的兴奋水平决定迫近刺激引发逃跑的概率，上丘到导水管周围灰质的突触通路参与触发逃跑。该结果针对上丘到导水管周围灰质的网络，不能单独归因于深白层或顶盖脊髓束。",
};

const cullen: BrainReference = {
  title:
    "The vestibular system: multimodal integration and encoding of self-motion for motor control",
  authors: "Cullen KE",
  year: 2012,
  journal: "Trends in Neurosciences",
  url: "https://doi.org/10.1016/j.tins.2011.12.001",
  finding:
    "综述前庭传入经第8脑神经进入脑干后，如何经内侧纵束驱动前庭眼动反射、经前庭脊髓束维持姿势，涵盖本页前庭相关各束的功能背景。实验证据主要来自灵长类与猫，小鼠研究沿用同一通路框架。",
};

const takatoh: BrainReference = {
  title:
    "New modules are added to vibrissal premotor circuitry with the emergence of exploratory whisking",
  authors: "Takatoh J, Nelson A, Zhou X, et al.",
  year: 2013,
  journal: "Neuron",
  url: "https://doi.org/10.1016/j.neuron.2012.11.010",
  finding:
    "在小鼠中解析驱动胡须运动的脑干前运动环路及其到面神经运动核的投射，是面神经支配胡须摆动这一功能的直接实验依据；此研究不直接检验三叉神经运动根。",
};

const petersen: BrainReference = {
  title: "The Functional Organization of the Barrel Cortex",
  authors: "Petersen CCH",
  year: 2007,
  journal: "Neuron",
  url: "https://doi.org/10.1016/j.neuron.2007.09.017",
  finding:
    "综述小鼠胡须触觉通路及桶状皮层的组织方式，汇总支持三叉感觉传入和触须辨别的实验研究。该综述未逐段测量本图谱中的神经根与纤维束。",
};

const mameli: BrainReference = {
  title:
    "Role of the trigeminal mesencephalic nucleus in rat whisker pad proprioception",
  authors: "Mameli O, Stanzani S, Mulliri G, et al.",
  year: 2010,
  journal: "Behavioral and Brain Functions",
  url: "https://doi.org/10.1186/1744-9081-6-69",
  finding:
    "在大鼠中记录并操控中脑三叉核，证明其传递胡须垫的本体感觉信号；中脑三叉束即该核一级感觉神经元的纤维，这是少有的直接功能实验。",
};

const cant: BrainReference = {
  title:
    "Parallel auditory pathways: projection patterns of the different neuronal populations in the dorsal and ventral cochlear nuclei",
  authors: "Cant NB, Benson CG",
  year: 2003,
  journal: "Brain Research Bulletin",
  url: "https://doi.org/10.1016/S0361-9230(03)00050-9",
  finding:
    "系统描述耳蜗核各细胞群的平行上行投射，包括背侧听纹与外侧丘系的构成，是听纹与外侧丘系传递听觉信息的解剖学基础。",
};

const medialOlivocochlear: BrainReference = {
  title: "Predicting vulnerability to acoustic injury with a noninvasive assay of olivocochlear reflex strength",
  authors: "Maison SF, Liberman MC",
  year: 2000,
  journal: "Journal of Neuroscience",
  url: "https://doi.org/10.1523/JNEUROSCI.20-12-04701.2000",
  finding:
    "豚鼠实验以耳声发射测量内侧橄榄耳蜗反射，并发现反射强度与随后噪声损伤程度相关。该结果针对内侧分支，不能代表橄榄耳蜗束的全部纤维。",
};

const lateralOlivocochlear: BrainReference = {
  title: "Cochlear efferent feedback balances interaural sensitivity",
  authors: "Darrow KN, Maison SF, Liberman MC",
  year: 2006,
  journal: "Nature Neuroscience",
  url: "https://doi.org/10.1038/nn1807",
  finding:
    "小鼠实验选择性损伤外侧橄榄耳蜗传出系统后，两耳听神经反应的平衡发生变化；该分支作用于内毛细胞下方的听神经末梢，与作用于外毛细胞的内侧分支不同。",
};

const travagli: BrainReference = {
  title: "Vagal neurocircuitry and its influence on gastric motility",
  authors: "Travagli RA, Anselmi L",
  year: 2016,
  journal: "Nature Reviews Gastroenterology & Hepatology",
  url: "https://doi.org/10.1038/nrgastro.2016.76",
  finding:
    "综述内脏感觉经迷走与孤束传入孤束核、再经迷走背运动核支配胃肠的环路，是孤束作为内脏感觉传导通路的功能依据。",
};

const apps: BrainReference = {
  title: "Cerebellar cortical organization: a one-map hypothesis",
  authors: "Apps R, Hawkes R",
  year: 2009,
  journal: "Nature Reviews Neuroscience",
  url: "https://doi.org/10.1038/nrn2698",
  finding:
    "综述小脑皮层的纵向分区及其经小脑白质与三个小脑脚的输入输出组织，支撑小脑白质与小脑脚按功能分区传递苔藓纤维、爬行纤维与小脑核输出。",
};

const haroian: BrainReference = {
  title: "Cerebellothalamic projections in the rat: An autoradiographic and degeneration study",
  authors: "Haroian AJ, Massopust LC, Young PA",
  year: 1981,
  journal: "Journal of Comparative Neurology",
  url: "https://doi.org/10.1002/cne.901970205",
  finding:
    "大鼠示踪发现顶核纤维在小脑内交叉，经小脑钩束的上行支抵达丘脑。该解剖结果不证明本图谱标注节段包含双向纤维，也不提供小鼠束级行为证据。",
};

const bosco: BrainReference = {
  title: "Proprioception from a spinocerebellar perspective",
  authors: "Bosco G, Poppele RE",
  year: 2001,
  journal: "Physiological Reviews",
  url: "https://doi.org/10.1152/physrev.2001.81.2.539",
  finding:
    "综述脊髓小脑束传递本体感觉和脊髓网络状态的生理研究，并区分腹侧与背侧通路。该综述提供通路背景，不是对本图谱纤维束的新实验。",
};

const paul: BrainReference = {
  title:
    "Agenesis of the corpus callosum: genetic, developmental and functional aspects of connectivity",
  authors: "Paul LK, Brown WS, Adolphs R, et al.",
  year: 2007,
  journal: "Nature Reviews Neuroscience",
  url: "https://doi.org/10.1038/nrn2107",
  finding:
    "综述胼胝体及其膝、压部连接两侧同源皮层的发育与功能，胼胝体发育不全患者的研究显示其在半球间信息整合中的作用。跨物种证据，具体到钳状纤维的小鼠功能实验有限。",
};

const wangClaustrum: BrainReference = {
  title: "Organization of the connections between claustrum and cortex in the mouse",
  authors: "Wang Q, Ng L, Harris JA, et al.",
  year: 2017,
  journal: "Journal of Comparative Neurology",
  url: "https://doi.org/10.1002/cne.24047",
  finding:
    "用顺行与逆行示踪测绘小鼠屏状核与皮层间的连接，这些纤维走行于外囊，是外囊承载屏状核-皮层联系的小鼠实验依据。外囊内还混有其他皮层下联系纤维。",
};

const vogt: BrainReference = {
  title:
    "Cytoarchitecture of mouse and rat cingulate cortex with human homologies",
  authors: "Vogt BA, Paxinos G",
  year: 2014,
  journal: "Brain Structure and Function",
  url: "https://doi.org/10.1007/s00429-012-0493-3",
  finding:
    "比较小鼠、大鼠扣带回皮层的细胞构筑与人类同源区，扣带束即位于扣带皮层深面的联络纤维。该文提供解剖学描述，扣带束的具体功能推断参考联合纤维的一般研究框架。",
};

const lemon: BrainReference = {
  title: "Descending Pathways in Motor Control",
  authors: "Lemon RN",
  year: 2008,
  journal: "Annual Review of Neuroscience",
  url: "https://doi.org/10.1146/annurev.neuro.31.060407.125547",
  finding:
    "综述皮层运动信号经内囊、大脑脚、锥体束下行并在锥体交叉换侧的解剖与生理，是皮质脊髓通路传递随意运动指令的依据；啮齿类锥体束主要终止于脊髓中间带，与灵长类直接支配运动神经元不同。",
};

const wangCst: BrainReference = {
  title: "Deconstruction of Corticospinal Circuits for Goal-Directed Motor Skills",
  authors: "Wang X, Liu Y, Li X, et al.",
  year: 2017,
  journal: "Cell",
  url: "https://doi.org/10.1016/j.cell.2017.08.014",
  finding:
    "在小鼠中用病毒示踪与损毁实验证明皮层脊髓通路对前肢抓握等目标导向技能动作必不可少，是锥体束功能的小鼠直接证据。",
};

const halassa: BrainReference = {
  title: "Thalamic functions in distributed cognitive control",
  authors: "Halassa MM, Kastner S",
  year: 2017,
  journal: "Nature Neuroscience",
  url: "https://doi.org/10.1038/s41593-017-0020-1",
  finding:
    "综述丘脑核团经丘脑辐射与皮层双向交换信息并参与认知控制，支撑丘脑髓板与丘脑辐射作为丘脑皮层联系通道的功能定位。",
};

const gerfen: BrainReference = {
  title: "Modulation of Striatal Projection Systems by Dopamine",
  authors: "Gerfen CR, Surmeier DJ",
  year: 2011,
  journal: "Annual Review of Neuroscience",
  url: "https://doi.org/10.1146/annurev-neuro-061010-113641",
  finding:
    "综述黑质致密部多巴胺神经元经黑质纹状体束支配背侧纹状体并调制直接与间接通路，是黑质纹状体束参与运动选择与强化的功能依据。",
};

const ruder: BrainReference = {
  title: "Brainstem Circuits Controlling Action Diversification",
  authors: "Ruder L, Arber S",
  year: 2019,
  journal: "Annual Review of Neuroscience",
  url: "https://doi.org/10.1146/annurev-neuro-070918-050201",
  finding:
    "综述脑干下行环路（含红核脊髓束、前庭脊髓束等）如何分化控制动作，并说明红核脊髓纤维在被盖腹侧交叉处跨中线。多为啮齿类与其他哺乳动物的混合证据。",
};

const fanselow: BrainReference = {
  title: "Are the Dorsal and Ventral Hippocampus Functionally Distinct Structures?",
  authors: "Fanselow MS, Dong HW",
  year: 2010,
  journal: "Neuron",
  url: "https://doi.org/10.1016/j.neuron.2009.11.031",
  finding:
    "综述啮齿类海马背腹段在连接与功能上的差异：背侧偏空间记忆、腹侧偏情绪，其输出分别经海马槽、伞与穹窿离开海马，为海马白质各段的功能区分提供框架。",
};

const hippocampalCommissure: BrainReference = {
  title: "Transection of the ventral hippocampal commissure impairs spatial reference but not contextual or spatial working memory",
  authors: "Jordan JT, Tong Y, Pytte CL",
  year: 2022,
  journal: "Learning & Memory",
  url: "https://doi.org/10.1101/lm.053483.121",
  finding:
    "小鼠腹侧海马连合包含来自海马背腹长轴各处的跨半球纤维；其切断影响所研究的部分空间导航任务。论文同时说明背侧海马连合主要连接海马外的皮层区域，连合名称不对应海马背侧或腹侧的专属输出。",
};

const aggleton: BrainReference = {
  title:
    "Episodic memory, amnesia, and the hippocampal-anterior thalamic axis",
  authors: "Aggleton JP, Brown MW",
  year: 1999,
  journal: "Behavioral and Brain Sciences",
  url: "https://doi.org/10.1017/S0140525X99002034",
  finding:
    "论证穹窿把海马输出送到乳头体与前丘脑，该轴损伤导致遗忘；为穹窿及乳头丘脑束参与记忆提供病变与实验依据，跨物种综述。",
};

const lebow: BrainReference = {
  title:
    "Overshadowed by the amygdala: the bed nucleus of the stria terminalis emerges as key to psychiatric disorders",
  authors: "Lebow MA, Chen A",
  year: 2016,
  journal: "Molecular Psychiatry",
  url: "https://doi.org/10.1038/mp.2016.1",
  finding:
    "综述终纹床核与杏仁核经终纹相连，参与持续威胁反应与焦虑相关行为；终纹是这条边缘联系的主要纤维通道。",
};

const vann: BrainReference = {
  title: "The mammillary bodies: two memory systems in one?",
  authors: "Vann SD, Aggleton JP",
  year: 2004,
  journal: "Nature Reviews Neuroscience",
  url: "https://doi.org/10.1038/nrn1299",
  finding:
    "综述乳头体经乳头丘脑束与前丘脑、经乳头被盖束与脑干的双向联系及其在空间与情景记忆中的作用，是乳头主束及其分支功能的主要依据。",
};

const hikosaka: BrainReference = {
  title:
    "The habenula: from stress evasion to value-based decision-making",
  authors: "Hikosaka O",
  year: 2010,
  journal: "Nature Reviews Neuroscience",
  url: "https://doi.org/10.1038/nrn2866",
  finding:
    "综述缰核经髓纹接受前脑输入、经后屈束投射到中缝与多巴胺系统并编码负性奖赏预测，是髓纹-缰-后屈束通路功能的主要依据。",
};

type WhiteMatterContent = {
  name: string;
  summary: string;
  function: string;
  evidence: string;
  references: BrainReference[];
};

// 键为 Kim v2 本体结构 ID，均经 gzip 标注体积核对存在非零体素。
// 按通路分组排列，组内条目共享直接相关文献；仅有解剖证据的条目在
// evidence 中明确说明，不把分区标注当作功能结论。
const CONTENT: Record<number, WhiteMatterContent> = {
  949: {
    name: "犁鼻神经",
    summary:
      "犁鼻器感觉神经元的轴突束，把信息素等化学信号从鼻腔犁鼻器传向副嗅球。在本分区中仅嗅球背侧边缘有少量体素。",
    function: "传递与先天社会行为相关的化学感受信号。",
    evidence:
      "功能依据来自犁鼻器受体与神经元研究；本数据只标注其进入嗅球的短段，不能据此判断感受类型。",
    references: [dulac, atlasKim],
  },
  1016: {
    name: "嗅神经层",
    summary:
      "覆盖嗅球表面的嗅感觉神经元轴突层，是嗅觉信息进入中枢的第一段通路，按受体类型汇聚到对应嗅小球。",
    function: "把气味受体的外周信号有序传入嗅球嗅小球。",
    evidence:
      "汇聚规律有直接的小鼠遗传与发育实验依据；本标签只界定轴突层的范围，解读限于传导与定位。",
    references: [mombaerts, atlasKim],
  },
  2279: {
    name: "背侧外侧嗅束",
    summary:
      "外侧嗅束靠背部的一支，PF 分区将其单列。本图谱未标出其中各类嗅球细胞轴突的比例。",
    function: "属于嗅球输出纤维通道，具体细胞来源与靶区需另行示踪确认。",
    evidence:
      "小鼠实验显示簇状与僧帽细胞具有不同的嗅皮层投射，但未将这些细胞的轴突逐一对应到本图谱的背侧外侧嗅束标签。",
    references: [igarashi, atlasKim],
  },
  665: {
    name: "外侧嗅束",
    summary:
      "嗅球僧帽与簇状细胞的主输出束，沿脑腹外侧表面向后走行，沿途支配梨状皮层等嗅皮层。",
    function: "把嗅球处理后的气味信息分发到各嗅皮层区域。",
    evidence:
      "小鼠实验直接证明僧帽细胞经此束向梨状皮层传递气味信息；束本身是混合纤维，不表示单一气味通道。",
    references: [igarashi, atlasKim],
  },
  900: {
    name: "前连合前部",
    summary:
      "前连合的前肢，连接两侧嗅前核与嗅皮层前部，横跨中线。",
    function: "在两侧嗅觉结构之间交换信息。",
    evidence:
      "小鼠嗅脚解剖研究支持前连合前肢的走行；本页所引文献未检验这一标注节段的独立行为作用。",
    references: [anteriorCommissure, atlasKim],
  },
  2317: {
    name: "前连合球内部",
    summary:
      "前连合在嗅球内穿行的一段，联系两侧嗅球结构。",
    function: "连接两侧嗅球与嗅前核，参与双侧嗅觉信息交换。",
    evidence:
      "解剖走行由连接组与分区图谱支持；本页所引文献未单独检验这一节段的行为作用。",
    references: [connectome, atlasKim],
  },
  117: {
    name: "视交叉",
    summary:
      "两侧视神经在此交叉，小鼠绝大多数视网膜纤维跨过中线投向对侧脑。本分区中标注体素很少，仅代表中线处的核心。",
    function: "决定视网膜纤维的左右侧投射，形成以对侧为主的视觉输入。",
    evidence:
      "交叉机制有小鼠分子与发育研究直接支持；此处只标注中线小区域，不代表完整神经。",
    references: [petros, atlasKim],
  },
  125: {
    name: "视束",
    summary:
      "视交叉后视网膜轴突的主干，绕丘脑腹侧走行，支配背外侧膝状体、上丘等视觉靶区。",
    function: "把各类视网膜神经节细胞的视觉信息分送到丘脑与中脑靶区。",
    evidence:
      "不同节细胞类型经视束投向不同靶区有小鼠示踪与成像证据；不能从本标签判断束内各轴突的信息类型。",
    references: [dhande, connectome],
  },
  916: {
    name: "上丘臂",
    summary:
      "视束通往上丘表面的纤维段，是视网膜等来源的纤维通往上丘的通道。",
    function: "把视觉输入送达上丘浅层，参与空间视觉与定向。",
    evidence:
      "视网膜到上丘的投射组成有小鼠研究直接支持；臂内还含非视网膜来源纤维，不能等同为纯视束延续。",
    references: [dhande, ito],
  },
  336: {
    name: "上丘连合",
    summary:
      "连接两侧上丘的跨中线纤维，位于上丘深面。",
    function: "在两侧上丘之间传递视觉与多感觉信息，可能参与双侧定向的协调。",
    evidence:
      "连合连接的解剖有上丘环路综述支持；本页所引文献未直接检验这段纤维在小鼠行为中的作用。",
    references: [ito, atlasKim],
  },
  2040: {
    name: "视上交叉",
    summary:
      "视交叉背侧的一组细小交叉纤维，经典解剖学将其分为若干成分，含投向丘脑与下丘脑的视性纤维。",
    function: "为部分视网膜与丘脑纤维提供跨中线通路，具体成分尚有历史争议。",
    evidence:
      "本页所引文献提供解剖与比较解剖学背景，未直接检验这组细小纤维在小鼠中的功能。",
    references: [atlasKim, petros],
  },
  17: {
    name: "上丘中白层",
    summary:
      "上丘运动部中间的纤维层，与中灰层交替排列，含浅层至深层的垂直联系与部分下行输出纤维。",
    function: "承载上丘内部跨层通信与感觉-运动转换的中间环节。",
    evidence:
      "上丘浅层分析、深层触发反应的分层框架来自哺乳动物电生理；小鼠直接实验多针对深层网络，中白层纤维本身未被单独操控。",
    references: [dean, evans, ito],
  },
  42: {
    name: "上丘深白层",
    summary:
      "上丘最深层，集中了投向脑干与脊髓的下行输出纤维，包括顶盖脊髓通路的起始段。",
    function: "承载上丘深层向脑干等靶区的输出，参与感觉运动信息传递。",
    evidence:
      "小鼠上丘网络的记录与操控支持其参与逃跑决策；这些结果不能证明深白层本身独立决定逃跑。",
    references: [evans, dean, ito],
  },
  62: {
    name: "内侧纵束",
    summary:
      "脑干中线旁的纵行纤维束，连接前庭核与动眼、滑车、展神经核并下达颈髓，协调眼动与头动。",
    function: "传递前庭眼动反射与凝视稳定所需的脑干信号。",
    evidence:
      "前庭-眼动通路功能有充分的哺乳动物生理证据；小鼠沿用同一框架，束内纤维的单独记录有限。",
    references: [cullen, atlasKim],
  },
  158: {
    name: "后连合",
    summary:
      "中脑-间脑交界处的跨中线纤维束，含与垂直凝视和瞳孔反射相关的核间联系。",
    function: "在中线两侧交换垂直眼动与瞳孔对光反射相关信号。",
    evidence:
      "垂直凝视受损与后连合区病变的关系主要来自临床与灵长类研究；本页所引文献未直接检验该束在小鼠中的功能。",
    references: [cullen, atlasKim],
  },
  93: {
    name: "三叉神经运动根",
    summary:
      "三叉神经运动核发出的轴突，支配咀嚼肌等第一鳃弓肌肉。",
    function: "驱动咀嚼与下颌运动。",
    evidence:
      "脑干运动输出的环路框架有小鼠研究支持；本页所引文献未单独操控该神经根，功能按支配肌肉的经典解剖给出。",
    references: [takatoh, atlasKim],
  },
  229: {
    name: "三叉神经感觉根",
    summary:
      "三叉神经节感觉轴突进入脑桥的主根，含触须触觉与面部感觉的传入纤维。",
    function: "把面部与触须感觉传入脑干三叉感觉核团。",
    evidence:
      "触须触觉经三叉丘系上传的功能组织有小鼠桶状皮层研究支持；根部的混合纤维不分单一感觉亚型。",
    references: [petersen, atlasKim],
  },
  705: {
    name: "中脑三叉束",
    summary:
      "中脑三叉核神经元的轴突束；该核是唯一位于脑内的一级感觉神经元群，传递咀嚼肌与牙周本体感觉。",
    function: "传导口面与触须垫的本体感觉，参与下颌反射。",
    evidence:
      "大鼠记录与操控直接证明其传递触须垫本体感觉；其作为中枢内一级感觉神经元的特殊地位是经典组织学结论。",
    references: [mameli, atlasKim],
  },
  794: {
    name: "脊髓三叉束",
    summary:
      "三叉感觉纤维在脑干下行的束，沿途终止于脊髓三叉核，处理面部分区与痛温觉等有序图谱。",
    function: "把面部感觉按躯体定位顺序分配到延髓与颈髓交界的三叉核。",
    evidence:
      "触须丘系通路的小鼠研究支持其感觉分工；痛温觉与触觉在束内的精细分布来自比较与临床研究，不属本数据的直接证据。",
    references: [petersen, atlasKim],
  },
  798: {
    name: "面神经",
    summary:
      "面神经运动核发出的轴突，绕展神经核形成内膝后出脑，支配表情肌与触须运动肌。",
    function: "驱动触须摆动与面部肌肉运动。",
    evidence:
      "小鼠胡须运动的前运动环路已被解析到面神经运动核，是触须摆动功能的直接依据。",
    references: [takatoh, atlasKim],
  },
  1116: {
    name: "面神经膝",
    summary:
      "面神经在脑干内环绕展神经核的弯曲段，是面神经轴突出脑前的特征性走行。",
    function: "为面神经运动纤维的脑内走行段，功能同面神经。",
    evidence:
      "仅为解剖走行结构；功能随面神经整体，本页所引文献未单独检验该弯曲段的功能。",
    references: [takatoh, atlasKim],
  },
  933: {
    name: "前庭蜗神经",
    summary:
      "第8脑神经，含耳蜗听觉与前庭平衡两类传入，进入脑桥延髓交界后分为两支。",
    function: "把听觉与平衡觉从耳蜗和前庭器官传入脑干。",
    evidence:
      "前庭与听觉传入的经典生理学证据充分；本数据标注的是颅内神经段，不包括感受器本身。",
    references: [cullen, cant],
  },
  413: {
    name: "前庭蜗神经前庭根",
    summary:
      "第8脑神经中前庭传入进入脑干的分支，纤维投向各前庭核。",
    function: "传递头部运动与平衡信号到前庭核。",
    evidence:
      "前庭信号编码与分发有系统的生理学综述支持；根本身为纯传入通道。",
    references: [cullen, atlasKim],
  },
  2461: {
    name: "第8脑神经前庭部间质核",
    summary:
      "嵌在前庭神经根纤维中的一小群神经元，属核团而非纤维束；PF 本体把它列在第8脑神经条目之下。",
    function: "接收并处理前庭传入的中继神经元，具体亚型功能研究有限。",
    evidence:
      "本数据因其本体位置而被白质筛选命中，但它是灰质核团；仅有解剖与前庭系统框架层面的证据，不提供独立功能结论。",
    references: [cullen, atlasKim],
  },
  2222: {
    name: "橄榄耳蜗束",
    summary:
      "自上橄榄复合体投向耳蜗的传出纤维。内侧分支主要作用于外毛细胞，外侧分支主要作用于内毛细胞下方的听神经末梢。",
    function: "调制耳蜗放大和听神经反应。",
    evidence:
      "豚鼠的耳声发射研究和小鼠的外侧分支损伤实验分别支持两种传出作用。本图谱仅标出 82 个 50 μm 体素，不能从该标签区分两类纤维。",
    references: [medialOlivocochlear, lateralOlivocochlear, atlasKim],
  },
  506: {
    name: "背侧听纹",
    summary:
      "背侧耳蜗核发出的上行纤维，跨过脑干背侧加入对侧外侧丘系。",
    function: "把背侧耳蜗核的单耳分析结果送往对侧下丘。",
    evidence:
      "耳蜗核平行通路的投射模式有解剖研究支持；本页所引文献未单独检验该听纹节段的功能。",
    references: [cant, atlasKim],
  },
  658: {
    name: "外侧丘系",
    summary:
      "脑干外侧的主听觉上行束，汇集双侧耳蜗核与上橄榄的输出，上行至下丘。",
    function: "把双耳整合后的听觉信息传向下丘。",
    evidence:
      "其构成与平行通路组织有直接解剖与生理证据；束内含多条平行通路，不代表单一听觉特征。",
    references: [cant, atlasKim],
  },
  482: {
    name: "下丘臂",
    summary:
      "连接下丘与内侧膝状体的纤维，是听觉信息进入丘脑的最后一段。",
    function: "把下丘整合的听觉信息传给内侧膝状体，再上行听皮层。",
    evidence:
      "听觉上行通路的组成有直接解剖证据；臂本身为传导通道。",
    references: [cant, atlasKim],
  },
  237: {
    name: "孤束",
    summary:
      "迷走、舌咽与面神经内脏传入在延髓内的纵行束，沿孤束核走行。",
    function: "把内脏与味觉信号传入孤束核，参与胃肠、心肺与味觉反射。",
    evidence:
      "迷走-孤束环路对胃肠功能的控制有实验与综述依据。Kim 图谱分别标注孤束和孤束核；两者紧邻，50 μm 重采样边界不能代表细胞尺度的精确分界。",
    references: [travagli, atlasKim],
  },
  293: {
    name: "前庭脊髓束",
    summary:
      "前庭核投向脊髓的下行纤维，调节伸肌张力与姿势反射。",
    function: "把平衡信息转化为姿势与抗重力肌控制。",
    evidence:
      "前庭下行控制姿势有系统的生理学证据；本标注仅覆盖脑干段，功能按整条通路给出。",
    references: [cullen, ruder],
  },
  744: {
    name: "小脑连合",
    summary:
      "两侧小脑之间的跨中线纤维，位于小脑白质内。",
    function: "协调两侧小脑皮层与核团的活动。",
    evidence:
      "小脑白质与分区组织的综述提供框架；本页所引文献未单独检验该连合的功能。",
    references: [apps, atlasKim],
  },
  326: {
    name: "小脑上脚",
    summary:
      "小脑的主要输出通道，含齿状核与间位核投向红核和丘脑的纤维，并含腹侧脊髓小脑束等传入。",
    function: "把小脑计算结果送向丘脑与红核，同时带入部分上行本体感觉。",
    evidence:
      "小脑输出的分区组织有综述支持；其双向纤维组成来自经典解剖，单一来源功能结论需谨慎。",
    references: [apps, bosco],
  },
  812: {
    name: "小脑上脚交叉",
    summary:
      "小脑上脚在中脑尾侧跨过中线的部位，使小脑输出主要作用于对侧前脑。",
    function: "完成小脑输出的对侧化。",
    evidence:
      "交叉走行是确定的解剖事实；交叉处无独立功能，解读限于解剖。",
    references: [apps, atlasKim],
  },
  85: {
    name: "腹侧脊髓小脑束",
    summary:
      "脊髓边缘细胞等发出的上行纤维，交叉后绕小脑上脚进入小脑，报告脊髓运动网络状态。",
    function: "向小脑实时报告脊髓中枢模式发生器与肢体状态。",
    evidence:
      "脊髓小脑通路的生理研究由综述汇总；其经上脚入脑的走行是经典解剖结论。",
    references: [bosco, apps],
  },
  850: {
    name: "小脑钩束",
    summary:
      "小脑顶核输出的一条弯曲纤维路径，部分纤维跨中线走向对侧脑干；名称不表示经此束往返的双向纤维。",
    function: "为部分顶核输出提供通道。",
    evidence:
      "经典示踪支持顶核跨侧输出的走行；本页所引文献未检验本图谱所标钩束节段的单独行为作用。",
    references: [haroian, atlasKim],
  },
  78: {
    name: "小脑中脚",
    summary:
      "最大的小脑脚，由对侧脑桥核发出的苔藓纤维组成，是皮层信息进入小脑的主通道。",
    function: "把皮层-脑桥信号大规模传入小脑皮层。",
    evidence:
      "皮层-脑桥-小脑通路的组织有综述支持；中脚几乎纯为传入纤维，功能随其来源的多样性而不可单一概括。",
    references: [apps, atlasKim],
  },
  2167: {
    name: "脑桥横行纤维",
    summary:
      "脑桥核轴突在脑桥内横向跨过中线、汇聚成小脑中脚的纤维。",
    function: "是皮层-脑桥-小脑通路在脑桥内的交叉段。",
    evidence:
      "走行与去向由小脑输入通路框架支持；本页所引文献未单独检验脑桥内这一节段的功能。",
    references: [apps, atlasKim],
  },
  1123: {
    name: "小脑下脚",
    summary:
      "含下橄榄爬行纤维、背侧脊髓小脑束与前庭小脑纤维等的主要传入通道，并含部分小脑至前庭核的输出。",
    function: "把脊髓、前庭与下橄榄的传入送进小脑。",
    evidence:
      "各组成通路的生理学依据充分；下脚为混合纤维，不能整体对应单一功能。",
    references: [bosco, apps],
  },
  2275: {
    name: "小脑白质",
    summary:
      "小脑内部的白质主干与叶片分支，含进出小脑皮层的全部纤维。",
    function: "在小脑皮层、核团与三个小脑脚之间组织全部通信。",
    evidence:
      "白质内纤维按纵向分区组织有综述支持；标注为整体白质，不能从中读出单条纤维走向。",
    references: [apps, atlasKim],
  },
  776: {
    name: "胼胝体",
    summary:
      "连接两侧大脑半球皮层的主连合纤维，是脑内最大的白质结构。",
    function: "整合两侧半球的感觉、运动与联想信息。",
    evidence:
      "胼胝体连接与功能有发育与临床综述支持；小鼠束内具体纤维的拓扑分布属解剖测量，非本数据直接显示。",
    references: [paul, connectome],
  },
  1108: {
    name: "胼胝体膝",
    summary:
      "胼胝体前端弯曲部，含连接两侧前额叶与前部皮层的纤维。",
    function: "连接两侧额叶皮层。",
    evidence:
      "按胼胝体前后拓扑的经典规律归属；本页所引文献未单独检验该亚段的小鼠功能。",
    references: [paul, atlasKim],
  },
  986: {
    name: "胼胝体压部",
    summary:
      "胼胝体后端，含连接两侧后部感觉与联合皮层的纤维。",
    function: "连接两侧后部皮层，含视觉区半球间纤维。",
    evidence:
      "同上，按胼胝体拓扑归属；本页所引文献未提供亚段级功能证据。",
    references: [paul, atlasKim],
  },
  956: {
    name: "胼胝体小钳",
    summary:
      "胼胝体纤维向前进入额叶的扇形展开部（额钳）。",
    function: "把胼胝体前部纤维分发到两侧额叶皮层。",
    evidence:
      "属胼胝体纤维的走行形态描述，功能随胼胝体前部；本页所引文献未单独检验该亚段。",
    references: [paul, atlasKim],
  },
  971: {
    name: "胼胝体大钳",
    summary:
      "胼胝体纤维向后进入枕叶的扇形展开部（枕钳）。",
    function: "把胼胝体后部纤维分发到两侧枕叶皮层。",
    evidence:
      "同为走行形态描述，功能随胼胝体后部；本页所引文献未单独检验该亚段。",
    references: [paul, atlasKim],
  },
  579: {
    name: "外囊",
    summary:
      "屏状核与壳核之间的纤维层，含屏状核与皮层间的往返纤维及部分皮层下联系。",
    function: "承载屏状核-皮层联系与其他经过该层的皮层下纤维。",
    evidence:
      "屏状核连接经外囊走行有小鼠示踪研究直接支持；外囊为混合纤维层，功能不能整体概括。",
    references: [wangClaustrum, connectome],
  },
  908: {
    name: "前连合后部",
    summary:
      "前连合的后肢，连接两侧颞叶相关结构，包括部分杏仁核与内嗅区联系。",
    function: "在两侧颞叶与边缘结构之间交换信息。",
    evidence:
      "连接模式有小鼠介观连接组支持；本页所引文献未单独检验后肢的行为作用。",
    references: [connectome, atlasKim],
  },
  940: {
    name: "扣带束",
    summary:
      "扣带皮层深面的纵行联络纤维，连接前后扣带及邻近边缘皮层。",
    function: "在扣带网络内部传递信息，参与情绪与认知相关皮层的纵向联系。",
    evidence:
      "扣带皮层的构筑与同源关系有比较解剖研究；束本身的功能多由皮层区研究推断，非束级直接实验。",
    references: [vogt, atlasKim],
  },
  443: {
    name: "背侧海马连合",
    summary:
      "位于腹侧海马连合背侧的跨中线纤维，在小鼠中主要连接两侧海马旁皮层区域。名称不表示它专门连接背侧海马。",
    function: "为两侧海马旁皮层区域提供跨半球联系。",
    evidence:
      "小鼠海马连合研究区分了连合的背腹名称与海马长轴分区；本页所引研究不支持把背侧海马的空间记忆功能直接归给这条连合。",
    references: [hippocampalCommissure, atlasKim],
  },
  449: {
    name: "腹侧海马连合",
    summary:
      "连接两侧海马的跨中线纤维，起止范围覆盖海马背腹长轴，而非仅限腹侧海马。",
    function: "支持两侧海马之间的信息交换；小鼠切断实验发现部分空间导航任务受损。",
    evidence:
      "小鼠切断实验的行为结果限于所测任务，不能据连合名称推断它只传递腹侧海马的情绪信息。",
    references: [hippocampalCommissure, atlasKim],
  },
  6: {
    name: "内囊",
    summary:
      "皮层与丘脑、脑干、脊髓之间纤维在纹状体内侧汇聚的致密白质，含皮质脊髓、皮质丘脑与丘脑皮层纤维。",
    function: "是端脑进出纤维的总通道。",
    evidence:
      "下行运动通路的组成有综述支持；内囊是混合纤维，功能区位的精细排序在啮齿类不如灵长类明确。",
    references: [lemon, wangCst],
  },
  924: {
    name: "大脑脚",
    summary:
      "内囊纤维在中脑腹侧的延续，含皮质脊髓、皮质脑桥与皮质红核等下行纤维。",
    function: "把皮层下行指令送向脑桥、脑干与脊髓。",
    evidence:
      "下行通路组成有综述支持；小鼠抓握等技能动作依赖该通路有直接实验依据。",
    references: [lemon, wangCst],
  },
  190: {
    name: "锥体束",
    summary:
      "大脑脚纤维在延髓腹侧集中的部分，即皮质脊髓束的延髓段。",
    function: "把皮层运动指令传向脊髓。",
    evidence:
      "小鼠皮质脊髓环路对目标导向技能动作的必要性有直接损毁与示踪证据；啮齿类终止模式与灵长类不同。",
    references: [wangCst, lemon],
  },
  198: {
    name: "锥体交叉",
    summary:
      "锥体束在延髓尾端跨过中线处，使每侧皮层控制对侧肢体。",
    function: "完成皮质脊髓纤维的对侧化。",
    evidence:
      "交叉走行为确定解剖事实；交叉处本身无独立功能，解读限于解剖。",
    references: [lemon, atlasKim],
  },
  2169: {
    name: "脑桥纵行纤维",
    summary:
      "下行纤维在脑桥内被桥核与横行纤维分隔成的纵向束段，是皮质脊髓与皮质脑桥纤维的脑桥段。",
    function: "承载经脑桥的皮层下行纤维。",
    evidence:
      "属皮质下行通路的局部形态，功能随整条通路；无节段级独立功能实验。",
    references: [lemon, atlasKim],
  },
  1092: {
    name: "丘脑外髓板",
    summary:
      "丘脑外侧面的纤维层，分隔丘脑网状核与其余丘脑核团，含丘脑皮层往返纤维。",
    function: "承载丘脑与皮层间的往返纤维，并界定网状核边界。",
    evidence:
      "丘脑皮层往返联系的功能有综述支持；髓板作为纤维层本身无独立功能实验。",
    references: [halassa, atlasKim],
  },
  2109: {
    name: "上丘脑辐射",
    summary:
      "丘脑背侧发出的上行纤维，PF 分区单列此标签；含丘脑向皮层投射的一部分。",
    function: "把丘脑核团的信息送向大脑皮层。",
    evidence:
      "丘脑-皮层投射参与认知控制有综述支持；该标签的边界定义依 PF 分区，功能按丘脑辐射整体框架给出。",
    references: [halassa, atlasKim],
  },
  102: {
    name: "黑质纹状体束",
    summary:
      "黑质致密部多巴胺神经元投向背侧纹状体的纤维束。",
    function: "向纹状体释放多巴胺，调制运动选择与强化学习。",
    evidence:
      "多巴胺调制纹状体直接与间接通路有充分综述与实验依据；束内也含非多巴胺纤维的解剖描述需谨慎。",
    references: [gerfen, atlasKim],
  },
  877: {
    name: "顶盖脊髓束",
    summary:
      "上丘深层投向颈髓与脑干网状结构的下行纤维，在被盖背侧交叉处跨中线。",
    function: "把上丘的定向与防御指令转化为头部与躯体动作。",
    evidence:
      "下行通路综述支持顶盖脊髓投射参与定向运动。上丘到导水管周围灰质的逃跑实验并未单独检验此束。",
    references: [lemon, dean],
  },
  1060: {
    name: "被盖背侧交叉",
    summary:
      "顶盖脊髓纤维在中脑被盖背侧跨中线处（Meynert 交叉）。",
    function: "完成顶盖脊髓输出的对侧化。",
    evidence:
      "交叉走行是确定解剖事实，功能随顶盖脊髓束整体；交叉处无独立功能。",
    references: [lemon, atlasKim],
  },
  863: {
    name: "红核脊髓束",
    summary:
      "红核大细胞部投向脊髓的下行纤维，在被盖腹侧交叉处跨中线，参与肢体运动控制。",
    function: "把红核的运动指令传向脊髓，参与肢体协调。",
    evidence:
      "脑干下行环路的功能分化有综述支持；小鼠红核脊髓系统的精细功能仍在研究中，解读保守。",
    references: [ruder, atlasKim],
  },
  397: {
    name: "被盖腹侧交叉",
    summary:
      "红核脊髓纤维在中脑被盖腹侧跨中线处（Forel 交叉）。",
    function: "完成红核脊髓输出的对侧化。",
    evidence:
      "交叉走行是确定解剖事实，功能随红核脊髓束整体；交叉处无独立功能。",
    references: [ruder, atlasKim],
  },
  941: {
    name: "前庭中脑束",
    summary:
      "前庭核与中脑之间的往返纤维，与前庭眼动及姿势通路相关。",
    function: "在前庭核与中脑凝视、姿势相关结构之间传递信号。",
    evidence:
      "按前庭系统通路框架给出功能；针对该束的单独实验很少，仅有通路级证据。",
    references: [cullen, atlasKim],
  },
  466: {
    name: "海马槽",
    summary:
      "海马CA与下托输出纤维在海马室面汇集的薄层白质，向后汇聚成伞。",
    function: "汇集海马输出纤维，是穹窿系统的起始段。",
    evidence:
      "海马输出经槽-伞-穹窿离脑是确定解剖；背腹段功能差异有综述支持。",
    references: [fanselow, aggleton],
  },
  603: {
    name: "海马伞",
    summary:
      "海马槽纤维在海马后内侧聚成的束，向前延续为穹窿。",
    function: "把海马输出集中并导向穹窿。",
    evidence:
      "走行与延续关系为确定解剖；功能随穹窿系统。",
    references: [fanselow, aggleton],
  },
  436: {
    name: "穹窿",
    summary:
      "海马与下托投向乳头体、隔区等的主要纤维束，分连合前与连合后两部。",
    function: "把海马输出送到间脑与基底前脑，是记忆环路的关键通道。",
    evidence:
      "穹窿损伤导致遗忘的跨物种证据充分；啮齿类与人类的纤维组成比例不同，直接外推需谨慎。",
    references: [aggleton, fanselow],
  },
  530: {
    name: "背侧穹窿",
    summary:
      "穹窿靠背侧的分支，PF 分区单列；主要含投向隔区等连合前靶区的纤维。",
    function: "把部分海马输出导向隔区与基底前脑。",
    evidence:
      "穹窿分支的靶区分配属解剖描述；本页所引文献未单独检验该分支的功能。",
    references: [aggleton, atlasKim],
  },
  301: {
    name: "终纹",
    summary:
      "杏仁核与终纹床核、下丘脑之间的主纤维通路，绕行丘脑尾侧。",
    function: "在杏仁核与终纹床核之间传递持续威胁与焦虑相关信号。",
    evidence:
      "终纹床核环路参与焦虑样行为有啮齿类实验与综述支持；终纹含双向纤维，功能不能简化为单向传递。",
    references: [lebow, atlasKim],
  },
  753: {
    name: "乳头主束",
    summary:
      "乳头体发出的主输出束，出核后分为乳头丘脑束与乳头被盖束。本标注中体素很少，仅代表分叉前的短段。",
    function: "把乳头体输出分配给前丘脑与脑干被盖。",
    evidence:
      "乳头体双输出系统及其记忆功能有综述支持；标注节段很短，仅为定位参考。",
    references: [vann, atlasKim],
  },
  690: {
    name: "乳头丘脑束",
    summary:
      "乳头体投向前丘脑核团的上行纤维，是海马-乳头体-丘脑记忆轴的一段。",
    function: "把乳头体信息传向前丘脑，参与空间定向与情景记忆。",
    evidence:
      "该轴的损伤与记忆障碍有跨物种证据支持；束本身为传导通道。",
    references: [vann, aggleton],
  },
  681: {
    name: "乳头被盖束",
    summary:
      "乳头体投向脑干被盖核的下行纤维，与前丘脑支共同构成乳头体双输出。",
    function: "把乳头体信息传向被盖背侧核，参与头部方向系统的环路。",
    evidence:
      "乳头体双输出的解剖与记忆功能有综述支持；本页所引文献未单独检验该束的行为作用。",
    references: [vann, atlasKim],
  },
  341: {
    name: "乳头后交叉",
    summary:
      "乳头体后方跨中线的小束纤维，含两侧乳头体间与被盖间的交叉联系。",
    function: "提供乳头体水平的跨中线联系。",
    evidence:
      "仅有解剖描述层面的证据；不提供超出走行的功能结论。",
    references: [vann, atlasKim],
  },
  802: {
    name: "髓纹",
    summary:
      "隔区、下丘脑前部等前脑结构投向缰核的纤维，沿丘脑背内侧走行。",
    function: "把前脑边缘信息传入缰核。",
    evidence:
      "缰核通路的组成与功能有综述支持；髓纹是缰核的主要传入通道。",
    references: [hikosaka, atlasKim],
  },
  595: {
    name: "后屈束",
    summary:
      "缰核投向中脑中缝核、脚间核与被盖的致密下行束，又称缰脚间束。",
    function: "把缰核的负性奖赏与厌恶信号传向多巴胺与5-羟色胺系统。",
    evidence:
      "缰核经后屈束调制单胺系统的功能有直接实验与综述支持，是该束功能的主要依据。",
    references: [hikosaka, atlasKim],
  },
  611: {
    name: "缰连合",
    summary:
      "连接两侧缰核的跨中线纤维，位于松果体下方。",
    function: "在两侧缰核之间交换信息。",
    evidence:
      "缰核系统的功能框架有综述支持；本页所引文献未直接检验缰连合自身的独立功能。",
    references: [hikosaka, atlasKim],
  },
};

CONTENT[697] = {
  name: "内侧丘系",
  summary: "后索核神经元的轴突在延髓交叉后组成的上行束，经过脑干投向对侧丘脑腹后外侧核。",
  function: "把躯干和肢体的精细触觉、振动与本体感觉信息传至丘脑。",
  evidence: "小鼠研究通过记录和操控后索核到丘脑的通路，区分了振动与持续接触等触觉信号。该实验支撑所属上行通路的功能，不等于逐段测量本页内侧丘系标签。",
  references: [{ title: "The encoding of touch by somatotopically aligned dorsal column subdivisions", authors: "Turecek J, Lehnert BP, Ginty DD", year: 2022, journal: "Nature", url: "https://doi.org/10.1038/s41586-022-05470-x", finding: "小鼠后索核记录与通路操控显示不同输入分别传递振动、接触起始和持续压力信息，并形成至丘脑的上行感觉通路。" }, atlasKim],
};
CONTENT[851] = {
  name: "上丘视神经层",
  summary: "位于上丘浅灰层下方，视网膜神经节细胞的轴突经此层进入上丘。该层以纤维为主，也含神经元。",
  function: "为视网膜输入进入上丘浅层提供通道，参与视觉信息传递。不能把整个上丘的视觉或防御功能归于这一纤维层。",
  evidence: "小鼠组织学与轴突示踪记录了视层内的有髓纤维及视网膜轴突。这支持其解剖归类，不证明该层单独决定某种行为。",
  references: [{
    title: "Molecular features distinguish ten neuronal types in the mouse superficial superior colliculus",
    authors: "Byun H, Kwon S, Ahn HJ, et al.", year: 2016, journal: "Journal of Comparative Neurology",
    url: "https://doi.org/10.1002/cne.23952",
    finding: "小鼠上丘组织学描述视层与浅灰层的分界、有髓纤维及层内神经元类型。",
  }, {
    title: "Development of the crossed retinocollicular projection in the mouse",
    authors: "Edwards MA, Schneider GE, Caviness VS Jr", year: 1986, journal: "Journal of Comparative Neurology",
    url: "https://doi.org/10.1002/cne.902480309",
    finding: "用纤维染色、Golgi 浸染与顺行示踪观察小鼠视网膜轴突在上丘视层中形成纤维束并向浅灰层分支。",
  }],
};
CONTENT[2219] = {
  name: "上髓帆",
  summary: "位于两侧小脑上脚之间的薄层白质，参与构成第四脑室顶。Kim 本体将其放在脑室分支，本页按解剖性质单独标为白质。",
  function: "提供第四脑室顶的解剖结构及局部纤维通行区域。现有引文不足以为小鼠上髓帆指定独立行为功能。",
  evidence: "Kim 数据支撑该结构的位置与边界。所引人体解剖研究仅用于白质薄板的形态说明，不能作为小鼠通路功能的实验证据。",
  references: [atlasKim, {
    title: "Medial-tonsillar telovelar approach for resection of a superior medullary velum cerebral cavernous malformation: anatomical and tractography study of the surgical approach and functional implications",
    authors: "Brogna C, Lavrador J, Kandeel H, et al.", year: 2021, journal: "Acta Neurochirurgica",
    url: "https://doi.org/10.1007/s00701-020-04418-2",
    finding: "人体解剖及纤维束成像描述上髓帆的白质薄板形态和与小脑上脚的关系；不提供小鼠功能实验证据。",
  }],
};

const CATEGORY = "白质结构 · PF";

// Negative catalog IDs isolate PF selections from Allen IDs.
export function getWhiteMatterRegions(data: AtlasData): BrainRegion[] {
  const regions: BrainRegion[] = [];
  for (const s of data.structures.values()) {
    if (!isWhiteMatterStructure(s)) continue;
    if (!data.meshes[String(s.id)]) continue;
    const content = CONTENT[s.id];
    if (!content) continue;
    regions.push({
      id: -s.id,
      acronym: s.acronym,
      name: content.name,
      englishName: s.name,
      category: CATEGORY,
      color: WHITE_MATTER_COLOR,
      summary: content.summary,
      function: content.function,
      evidence: content.evidence,
      references: content.references,
    });
  }
  return regions.sort((a, b) => a.name.localeCompare(b.name, "zh"));
}
