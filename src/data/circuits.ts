import { circuitReferences, type BrainReference } from "./regions";

export type BrainCircuit = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  nodeIds: number[];
  edges: {
    from: number;
    to: number;
    label: string;
    kind: "excitatory" | "inhibitory" | "modulatory" | "projection";
  }[];
  evidence: string;
  references: BrainReference[];
};

export const brainCircuits: BrainCircuit[] = [
  {
    id: "basal-ganglia-output",
    name: "基底节输出通路",
    subtitle: "直接通路与经 GPe、STN 的间接通路",
    description:
      "从尾状壳核观察两类输出：一类投向黑质网状部，另一类先进入苍白球外侧部。经 GPe 的输出既可通过 STN 兴奋 SNr，也有直接到 SNr 的抑制分支；SNr 再向丘脑腹内侧核投射。",
    nodeIds: [672, 1022, 470, 381, 685],
    edges: [
      {
        from: 672,
        to: 381,
        label: "直接通路细胞的 GABA 输出",
        kind: "inhibitory",
      },
      {
        from: 672,
        to: 1022,
        label: "间接通路细胞的 GABA 输出",
        kind: "inhibitory",
      },
      {
        from: 1022,
        to: 381,
        label: "GPe 到 SNr 的抑制性分支",
        kind: "inhibitory",
      },
      { from: 1022, to: 470, label: "GPe 到 STN 的 GABA 抑制性投射", kind: "inhibitory" },
      { from: 470, to: 381, label: "STN 的谷氨酸细胞兴奋 SNr", kind: "excitatory" },
      { from: 381, to: 685, label: "黑质向丘脑的输出投射", kind: "projection" },
    ],
    evidence:
      "CP 内两类通路细胞在空间上交错，图谱无法把它们分成两块。此图省略皮层超直接通路、部分回返连接及其他靶点；自然运动中两类细胞可以共同活动。箭头连接区域定位点，不表示真实轴突路径或突触强度。",
    references: [circuitReferences.basalMap, circuitReferences.basal, circuitReferences.pallidal, {
      title: "Causal role for the subthalamic nucleus in interrupting behavior", authors: "Fife KH, Gutierrez-Reed NA, Zell V, et al.", year: 2017, journal: "eLife", url: "https://doi.org/10.7554/eLife.27689", finding: "小鼠光遗传刺激与电生理证实 STN 兴奋 SNr 等输出核团，并研究其对行为中断的影响。",
    }],
  },
  {
    id: "raphe-vta-accumbens",
    name: "VTA 多巴胺相关投射",
    subtitle: "背侧缝核输入与伏隔核输出",
    description:
      "细胞类型特异示踪发现，VTA 多巴胺细胞接收背侧缝核的输入，并向伏隔核等前脑区域投射。不同 VTA 细胞的输入偏好和输出靶区并不相同。",
    nodeIds: [872, 749, 56],
    edges: [
      {
        from: 872,
        to: 749,
        label: "DR 到 VTA 的细胞类型混合输入",
        kind: "projection",
      },
      {
        from: 749,
        to: 56,
        label: "VTA 多巴胺细胞到伏隔核",
        kind: "modulatory",
      },
    ],
    evidence:
      "背侧缝核输入包含血清素及 GABA 等不同细胞来源，故不指定统一兴奋或抑制符号。两条边概括已验证的投射关系，不证明它们在同一条串联回路中共同引起奖赏，也不把全部 VTA 活动解释为奖赏信号。",
    references: [circuitReferences.dopamine],
  },
  {
    id: "colliculus-pag-escape",
    name: "上丘至 PAG 逃逸通路",
    subtitle: "威胁信号与逃逸阈值",
    description:
      "小鼠内侧上丘深层的兴奋性细胞将威胁相关信号传给背侧导水管周围灰质。该连接的突触性质参与决定何时启动逃逸。",
    nodeIds: [294, 795],
    edges: [
      {
        from: 294,
        to: 795,
        label: "内侧上丘深层到背侧 PAG 的兴奋性输入",
        kind: "excitatory",
      },
    ],
    evidence:
      "钙成像、电生理和光遗传操控支持这条单突触兴奋性连接。实验范围是 SCm 内侧深层及 PAG 背侧的特定细胞群，三维高亮显示的整块脑区比实际实验范围更大。",
    references: [circuitReferences.escape],
  },
  {
    id: "nts-parabrachial-amygdala",
    name: "脑干进食抑制通路",
    subtitle: "孤束核、臂旁核与中央杏仁核",
    description:
      "NTS 中的特定 CCK 和 DBH 细胞可以直接兴奋外侧 PB 的 CGRP 细胞。PB 的这些细胞向中央杏仁核投射，参与身体不适等条件下的进食抑制。",
    nodeIds: [651, 867, 536],
    edges: [
      {
        from: 651,
        to: 867,
        label: "NTS 的 CCK/DBH 细胞兴奋 PB 的 CGRP 细胞",
        kind: "excitatory",
      },
      {
        from: 867,
        to: 536,
        label: "PB 的 CGRP 细胞投向中央杏仁核",
        kind: "projection",
      },
    ],
    evidence:
      "两项小鼠原始研究分别检验上游输入和下游投射，提供细胞及通路操控证据。此图只展示进食调节网络的一部分，不能把 NTS、PB 或 CEA 整体定义为食欲抑制中心。",
    references: [circuitReferences.nts, circuitReferences.appetite],
  },
  {
    id: "hippocampal-trisynaptic",
    name: "海马三突触通路",
    subtitle: "内嗅区 → 齿状回 → CA3 → CA1",
    description: "内嗅皮层经穿通路向齿状回传入信息，齿状回颗粒细胞通过苔藓纤维投向 CA3，再由 Schaffer 侧支连接 CA1。图中同时保留内嗅区直接到 CA1 的支路。",
    nodeIds: [909, 726, 463, 382],
    edges: [
      { from: 909, to: 726, kind: "excitatory", label: "内嗅区 II 层经穿通路兴奋齿状回颗粒细胞" },
      { from: 726, to: 463, kind: "excitatory", label: "颗粒细胞的苔藓纤维投向 CA3 锥体细胞" },
      { from: 463, to: 382, kind: "excitatory", label: "CA3 经 Schaffer 侧支兴奋 CA1" },
      { from: 909, to: 382, kind: "excitatory", label: "内嗅区 III 层直接投向 CA1，形成单突触支路" },
    ],
    evidence: "这是一条经典兴奋性主细胞通路的简图，省略局部抑制、CA3 回返连接、CA2 及下托。ENT 高亮覆盖整个内嗅区，不能表达不同层的精细投射。小鼠原始研究同时发现经典图之外的连接，不能把全部海马信息流限定为串联三步。",
    references: [{ title: "Cell type–specific genetic and optogenetic tools reveal hippocampal CA2 circuits", authors: "Kohara K, Pignatelli M, Rivest AJ, et al.", year: 2014, journal: "Nature Neuroscience", url: "https://doi.org/10.1038/nn.3614", finding: "小鼠细胞类型特异示踪、光遗传与膜片钳研究以三突触及内嗅区直接到 CA1 的通路为背景，进一步揭示 DG 到 CA2 等非经典连接。" }],
  },
  {
    id: "prefrontal-md-loop",
    name: "丘脑—前额叶回路",
    subtitle: "MD 与前边缘皮层的双向联系",
    description: "丘脑内侧背核与内侧前额叶相互连接。在小鼠选择性注意任务中，MD 支持前额叶规则表征的维持，并调节皮层网络之间的有效联系。",
    nodeIds: [362, 972],
    edges: [
      { from: 362, to: 972, kind: "excitatory", label: "MD 丘脑皮层输入支持前额叶活动的维持" },
      { from: 972, to: 362, kind: "excitatory", label: "前额叶皮层向 MD 的反馈投射" },
    ],
    evidence: "示意图用 PL 表示论文涉及的前额叶区域，整块 PL 并不等同于实验细胞集合。兴奋性投射可通过局部抑制网络产生复杂净效应；箭头不表示某条规则内容由 MD 原样传递。",
    references: [{ title: "Thalamic amplification of cortical connectivity sustains attentional control", authors: "Schmitt LI, Wimmer RD, Nakajima M, et al.", year: 2017, journal: "Nature", url: "https://doi.org/10.1038/nature22073", finding: "小鼠记录、光遗传与网络分析表明 MD 放大前额叶内有效连接，支持注意规则表征的持续。" }],
  },
  {
    id: "amygdala-pag-freezing",
    name: "杏仁核—PAG 冻结通路",
    subtitle: "抑制性输入如何通过去抑制产生冻结",
    description: "中央杏仁核的一类抑制性投射作用于腹外侧 PAG 的抑制性细胞，释放 PAG 兴奋性输出，使冻结反应能够表达。",
    nodeIds: [536, 795],
    edges: [{ from: 536, to: 795, kind: "inhibitory", label: "CEA 抑制 vlPAG 的局部抑制细胞，间接释放冻结相关输出" }],
    evidence: "小鼠示踪、电生理与光遗传实验支持该去抑制机制。这里的负号指这条突触输入，不代表抑制整个 PAG 或抑制冻结行为；三维整块 PAG 也不能区分腹外侧亚区及其中不同细胞。",
    references: [{ title: "Midbrain circuits for defensive behaviour", authors: "Tovote P, Esposito MS, Botta P, et al.", year: 2016, journal: "Nature", url: "https://doi.org/10.1038/nature17996", finding: "鉴定 CEA 到腹外侧 PAG 的抑制性投射，表明该投射通过去抑制 PAG 兴奋性输出来产生冻结，并与逃逸相关网络相互作用。" }],
  },
];
