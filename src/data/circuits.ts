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
    subtitle: "纹状体的直接分支与经 GPe 的间接分支",
    description:
      "从尾状壳核观察两类输出：一类投向黑质网状部，另一类先进入苍白球外侧部。此处展示小鼠研究支持的 GPe 到 SNr 分支，以及 SNr 到丘脑腹内侧核的投射。",
    nodeIds: [672, 1022, 381, 685],
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
      { from: 381, to: 685, label: "黑质向丘脑的输出投射", kind: "projection" },
    ],
    evidence:
      "CP 内两类通路细胞在空间上交错，图谱无法把它们分成两块。此图省略 STN 分支、回返连接及其他靶点；自然运动中两类细胞可以共同活动。箭头连接区域定位点，不表示真实轴突路径或突触强度。",
    references: [circuitReferences.basalMap, circuitReferences.basal],
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
];
