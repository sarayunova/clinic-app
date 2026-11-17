export type FdaPregnancyCategory = 'A' | 'B' | 'C' | 'D' | 'X' | 'N/A';
export type MedicationRiskLevel = 'safe' | 'caution' | 'high_risk' | 'contraindicated';
export type LactationSafetyRating = 'compatible' | 'caution' | 'contraindicated';

export interface TrimesterSpecificRule {
  riskLevel: MedicationRiskLevel;
  warning: string;
}

export interface MedicationSafetyRule {
  id: string;
  genericName: string;
  aliases: string[]; // Brand names or common synonyms
  drugClass: string;
  fdaCategory: FdaPregnancyCategory;
  defaultRiskLevel: MedicationRiskLevel;
  trimesterSpecificRisk?: {
    t1?: TrimesterSpecificRule;
    t2?: TrimesterSpecificRule;
    t3?: TrimesterSpecificRule;
  };
  mechanism: string;
  fetalRisks: string;
  lactationSafety: LactationSafetyRating;
  lactationAdvice: string;
  suggestedAlternatives: string[];
}

export const PREGNANCY_MEDICATION_DATABASE: MedicationSafetyRule[] = [
  // ==========================================
  // CONTRAINDICATED / HIGH RISK TERATOGENS
  // ==========================================
  {
    id: 'ace-inhibitors-arbs',
    genericName: 'ACE Inhibitors & ARBs (Telmisartan, Enalapril, Ramipril, Losartan, Olmesartan)',
    aliases: [
      'telmisartan', 'enalapril', 'ramipril', 'losartan', 'olmesartan', 'valsartan', 'lisinopril',
      'telma', 'enam', 'cardace', 'losar', 'olmat', 'repace', 'vasotec'
    ],
    drugClass: 'Renin-Angiotensin Antihypertensive',
    fdaCategory: 'D',
    defaultRiskLevel: 'contraindicated',
    trimesterSpecificRisk: {
      t1: { riskLevel: 'high_risk', warning: 'Early organogenesis cardiovascular & renal developmental vulnerability.' },
      t2: { riskLevel: 'contraindicated', warning: 'Fetal renal dysgenesis, severe oligohydramnios, pulmonary hypoplasia.' },
      t3: { riskLevel: 'contraindicated', warning: 'Neonatal anuria, renal failure, skull bone hypocalvaria, limb contractures.' },
    },
    mechanism: 'Blocks fetal angiotensin II required for normal fetal renal perfusion, urine production, and calvarial bone development.',
    fetalRisks: 'Renal dysgenesis, Potter sequence (severe oligohydramnios, pulmonary hypoplasia, compressed facies), hypocalvaria, neonatal renal failure.',
    lactationSafety: 'caution',
    lactationAdvice: 'Excreted in low levels; monitor infant renal function and blood pressure. Enalapril is preferred if needed postpartum.',
    suggestedAlternatives: ['Labetalol (100–400 mg bid)', 'Methyldopa (250–500 mg tid)', 'Nifedipine Retard (20–40 mg bid)'],
  },
  {
    id: 'nsaids-systemic',
    genericName: 'NSAIDs (Ibuprofen, Diclofenac, Naproxen, Mefenamic Acid, Indomethacin, Ketorolac)',
    aliases: [
      'ibuprofen', 'diclofenac', 'naproxen', 'mefenamic', 'indomethacin', 'ketorolac', 'piroxicam',
      'brufen', 'voveran', 'combiflam', 'meftal', 'naprosyn', 'toradol', 'feldene'
    ],
    drugClass: 'Non-Steroidal Anti-Inflammatory (NSAID)',
    fdaCategory: 'C',
    defaultRiskLevel: 'caution',
    trimesterSpecificRisk: {
      t1: { riskLevel: 'caution', warning: 'Possible increased risk of miscarriage or cardiac septal defects with prolonged use.' },
      t2: { riskLevel: 'caution', warning: 'Fetal renal perfusion monitoring indicated if used for >48 hours.' },
      t3: { riskLevel: 'contraindicated', warning: 'CONTRAINDICATED in 3rd trimester (≥28 weeks): causes premature closure of ductus arteriosus, persistent pulmonary hypertension (PPHN), and oligohydramnios.' },
    },
    mechanism: 'Inhibits cyclooxygenase (COX-1/COX-2), decreasing prostaglandin E2 which keeps ductus arteriosus patent and maintains fetal renal perfusion.',
    fetalRisks: 'Premature constriction/closure of ductus arteriosus, neonatal pulmonary hypertension (PPHN), oligohydramnios, neonatal necrotizing enterocolitis, intracranial bleeding.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Ibuprofen has negligible breast milk transfer and is safe during breastfeeding. Avoid prolonged high doses.',
    suggestedAlternatives: ['Paracetamol (Acetaminophen 500–1000 mg tid/qid)', 'Non-pharmacologic pain management'],
  },
  {
    id: 'statins',
    genericName: 'Statins (Atorvastatin, Rosuvastatin, Simvastatin, Pravastatin)',
    aliases: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'atorva', 'lipitor', 'rovas', 'crestor', 'zocor'],
    drugClass: 'HMG-CoA Reductase Inhibitor',
    fdaCategory: 'X',
    defaultRiskLevel: 'contraindicated',
    mechanism: 'Inhibits cholesterol synthesis. Cholesterol is an essential substrate for fetal cell membrane formation, myelin sheath, and steroidogenesis.',
    fetalRisks: 'Congenital vertebral, anal, cardiac, tracheo-esophageal, renal and limb (VACTERL) associations; severe intrauterine growth restriction.',
    lactationSafety: 'contraindicated',
    lactationAdvice: 'Potential disruption of infant lipid metabolism. Discontinue statins during breastfeeding.',
    suggestedAlternatives: ['Discontinue during pregnancy', 'Dietary medical nutrition therapy (MNT)', 'Bile acid sequestrants if familial hypercholesterolemia'],
  },
  {
    id: 'valproate',
    genericName: 'Sodium Valproate / Divalproex',
    aliases: ['valproate', 'valproic acid', 'divalproex', 'valparin', 'encorate', 'depakote', 'epilim'],
    drugClass: 'Antiepileptic / Mood Stabilizer',
    fdaCategory: 'X',
    defaultRiskLevel: 'contraindicated',
    mechanism: 'Inhibits histone deacetylase, induces neural crest cell apoptosis, and impairs folate metabolism during embryonic organogenesis.',
    fetalRisks: 'Neural tube defects (spina bifida ~1–2%), craniofacial clefts, cardiovascular malformations, hypospadias, autism spectrum disorder, and 7–10 point IQ reduction.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Low breast milk transfer. Monitor infant for sedation and hepatotoxicity.',
    suggestedAlternatives: ['Levetiracetam (Keppra)', 'Lamotrigine (Lamictal)', 'High-dose Folic Acid (5 mg/day preconception & T1)'],
  },
  {
    id: 'carbamazepine-phenytoin',
    genericName: 'Carbamazepine / Phenytoin',
    aliases: ['carbamazepine', 'phenytoin', 'tegretol', 'mazetol', 'eptoin', 'dilantin'],
    drugClass: 'Antiepileptic',
    fdaCategory: 'D',
    defaultRiskLevel: 'high_risk',
    mechanism: 'Antifolate action, free radical intermediate generation, oxidative stress during organogenesis.',
    fetalRisks: 'Fetal hydantoin/carbamazepine syndrome: microcephaly, hypoplastic nails and distal phalanges, cardiac defects, cleft lip/palate, developmental delay.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Compatible with breastfeeding; monitor infant for drowsiness and poor feeding.',
    suggestedAlternatives: ['Levetiracetam', 'Lamotrigine', 'High-dose Folic Acid 5mg daily'],
  },
  {
    id: 'tetracyclines',
    genericName: 'Tetracyclines (Doxycycline, Minocycline, Tetracycline)',
    aliases: ['doxycycline', 'minocycline', 'tetracycline', 'doxy', 'doxicip', 'minoz'],
    drugClass: 'Tetracycline Antibiotic',
    fdaCategory: 'D',
    defaultRiskLevel: 'high_risk',
    trimesterSpecificRisk: {
      t1: { riskLevel: 'caution', warning: 'Safe for very short bursts if no alternatives, but avoid if possible.' },
      t2: { riskLevel: 'high_risk', warning: 'Chelates calcium in deciduous teeth buds; causes permanent yellow-brown dental staining and enamel hypoplasia.' },
      t3: { riskLevel: 'high_risk', warning: 'Permanent tooth discoloration and temporary depression of fibula bone growth.' },
    },
    mechanism: 'Forms a stable calcium complex in bone and tooth-forming tissue during calcification.',
    fetalRisks: 'Permanent yellow-gray-brown discoloration of teeth, enamel hypoplasia, reversible inhibition of fetal bone growth.',
    lactationSafety: 'caution',
    lactationAdvice: 'Short-term use (<14 days) is considered acceptable due to calcium binding in breast milk, but alternatives preferred.',
    suggestedAlternatives: ['Amoxicillin-Clavulanate (Augmentin)', 'Cefuroxime (Ceftum)', 'Azithromycin (Azee)'],
  },
  {
    id: 'fluoroquinolones',
    genericName: 'Fluoroquinolones (Ciprofloxacin, Levofloxacin, Ofloxacin, Norfloxacin)',
    aliases: ['ciprofloxacin', 'levofloxacin', 'ofloxacin', 'norfloxacin', 'cipro', 'cifran', 'levoquine', 'oflox', 'norflox'],
    drugClass: 'Fluoroquinolone Antibiotic',
    fdaCategory: 'C',
    defaultRiskLevel: 'caution',
    mechanism: 'High affinity for bone and cartilage tissue; inhibits DNA gyrase.',
    fetalRisks: 'Cartilage toxicity, arthropathy in weight-bearing joints demonstrated in juvenile animal studies.',
    lactationSafety: 'caution',
    lactationAdvice: 'Low concentrations in milk; monitor infant for loose stools or oral thrush. Prefer cephalosporins.',
    suggestedAlternatives: ['Amoxicillin-Clavulanate', 'Cefuroxime', 'Cefpodoxime', 'Azithromycin'],
  },
  {
    id: 'aminoglycosides',
    genericName: 'Aminoglycosides (Gentamicin, Amikacin, Tobramycin)',
    aliases: ['gentamicin', 'amikacin', 'tobramycin', 'genticyn', 'mikacin'],
    drugClass: 'Aminoglycoside Antibiotic',
    fdaCategory: 'D',
    defaultRiskLevel: 'high_risk',
    mechanism: 'Penetrates placenta and concentrates in fetal labyrinth and perilymph of inner ear and renal cortex.',
    fetalRisks: 'Congenital bilateral irreversible sensorineural deafness (cranial nerve VIII ototoxicity), fetal nephrotoxicity.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Poorly absorbed from infant GI tract; safe during breastfeeding.',
    suggestedAlternatives: ['Third-generation Cephalosporins (Ceftriaxone, Cefotaxime)', 'Piperacillin-Tazobactam (if indicated)'],
  },
  {
    id: 'nitrofurantoin',
    genericName: 'Nitrofurantoin',
    aliases: ['nitrofurantoin', 'urifast', 'martifur', 'macrodantin', 'macrobid'],
    drugClass: 'Urinary Antiseptic',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    trimesterSpecificRisk: {
      t1: { riskLevel: 'safe', warning: 'First-line recommended agent for asymptomatic bacteriuria and uncomplicated UTI.' },
      t2: { riskLevel: 'safe', warning: 'Safe and effective for antenatal UTI.' },
      t3: { riskLevel: 'caution', warning: 'Avoid near term (≥36 weeks) due to potential risk of neonatal hemolytic anemia in G6PD deficiency.' },
    },
    mechanism: 'Inactivates bacterial ribosomal proteins. May precipitate hemolysis in immature red cells lacking glutathione.',
    fetalRisks: 'Neonatal hemolytic anemia if administered at delivery in G6PD-deficient neonates.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Compatible unless infant is known to be G6PD deficient or jaundiced.',
    suggestedAlternatives: ['Amoxicillin-Clavulanate', 'Cefixime', 'Cephalexin'],
  },
  {
    id: 'methotrexate',
    genericName: 'Methotrexate',
    aliases: ['methotrexate', 'folitrax', 'trexall'],
    drugClass: 'Antimetabolite / Folate Antagonist',
    fdaCategory: 'X',
    defaultRiskLevel: 'contraindicated',
    mechanism: 'Inhibits dihydrofolate reductase; blocks thymidylate and DNA synthesis during rapid fetal organogenesis.',
    fetalRisks: 'Methotrexate embryopathy: cranial dysostosis, cloverleaf skull, hypertelorism, micrognathia, limb hypoplasia, intrauterine death.',
    lactationSafety: 'contraindicated',
    lactationAdvice: 'Excreted in milk and accumulates in neonatal tissues; contraindicated during breastfeeding.',
    suggestedAlternatives: ['Discontinue at least 3 months prior to conception', 'Sulfasalazine (with folic acid 5mg) if IBD/rheumatologic'],
  },
  {
    id: 'warfarin',
    genericName: 'Warfarin',
    aliases: ['warfarin', 'coumadin', 'uniwarfin'],
    drugClass: 'Vitamin K Antagonist',
    fdaCategory: 'X',
    defaultRiskLevel: 'contraindicated',
    trimesterSpecificRisk: {
      t1: { riskLevel: 'contraindicated', warning: 'Warfarin embryopathy (6–9 weeks): nasal hypoplasia, stippled epiphyses, microcephaly.' },
      t2: { riskLevel: 'high_risk', warning: 'Fetal intracranial hemorrhage, optic atrophy, microphthalmia.' },
      t3: { riskLevel: 'contraindicated', warning: 'High risk of massive maternal and fetal intracranial hemorrhage during delivery.' },
    },
    mechanism: 'Crosses placenta; inhibits vitamin K-dependent clotting factors and osteocalcin synthesis in developing bone.',
    fetalRisks: 'Warfarin embryopathy (nasal hypoplasia, chondrodysplasia punctata, short phalanges), microcephaly, optic atrophy, fetal death.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Warfarin does not pass into breast milk in significant amounts; safe during breastfeeding.',
    suggestedAlternatives: ['Enoxaparin (Clexane, LMWH 40–80 mg/day)', 'Unfractionated Heparin (does not cross placenta)'],
  },
  {
    id: 'isotretinoin',
    genericName: 'Isotretinoin (Oral Retinoids)',
    aliases: ['isotretinoin', 'acutret', 'roaccutane', 'sotret'],
    drugClass: 'Oral Retinoid',
    fdaCategory: 'X',
    defaultRiskLevel: 'contraindicated',
    mechanism: 'Disrupts cellular differentiation, Hox gene signaling, and neural crest cell migration.',
    fetalRisks: 'Isotretinoin embryopathy: craniofacial (microtia/anotia, micrognathia), CNS (hydrocephalus, cerebellar hypoplasia), cardiac (conotruncal, transposition), thymic aplasia. Risk of anomaly >35%.',
    lactationSafety: 'contraindicated',
    lactationAdvice: 'High risk of lipid-soluble accumulation in milk. Contraindicated.',
    suggestedAlternatives: ['Topical azelaic acid', 'Topical clindamycin', 'Topical erythromycin'],
  },
  {
    id: 'methimazole-carbimazole',
    genericName: 'Methimazole / Carbimazole',
    aliases: ['methimazole', 'carbimazole', 'neo-mercazole', 'tapazole'],
    drugClass: 'Antithyroid Thioamide',
    fdaCategory: 'D',
    defaultRiskLevel: 'high_risk',
    trimesterSpecificRisk: {
      t1: { riskLevel: 'high_risk', warning: 'Methimazole embryopathy in T1: aplasia cutis congenita, choanal atresia, tracheo-esophageal fistula.' },
      t2: { riskLevel: 'safe', warning: 'Preferred in T2 and T3 due to lower maternal hepatotoxicity than PTU.' },
      t3: { riskLevel: 'safe', warning: 'Preferred in T3; monitor fetal thyroid gland for goiter.' },
    },
    mechanism: 'Inhibits thyroid peroxidase. Teratogenic in early embryonic ectoderm and branchial arches.',
    fetalRisks: 'Aplasia cutis congenita (scalp skin defects), choanal atresia, esophageal atresia, fetal hypothyroidism and goiter.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Excreted in low levels. Safe up to 20 mg/day; monitor infant thyroid function.',
    suggestedAlternatives: ['Propylthiouracil (PTU) preferred in 1st trimester', 'Switch to Methimazole after 14 weeks'],
  },

  // ==========================================
  // SAFE FIRST-LINE ANTENATAL MEDICATIONS (CAT A & B)
  // ==========================================
  {
    id: 'paracetamol',
    genericName: 'Paracetamol (Acetaminophen)',
    aliases: ['paracetamol', 'acetaminophen', 'crocin', 'calpol', 'dolo', 'panadol', 'tylenol'],
    drugClass: 'Analgesic & Antipyretic',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    mechanism: 'Centrally acting analgesic/antipyretic; does not affect peripheral prostaglandin synthesis or ductus arteriosus.',
    fetalRisks: 'Gold-standard safe analgesic in all three trimesters when used at recommended doses (max 4g/day).',
    lactationSafety: 'compatible',
    lactationAdvice: 'Minimal excretion into breast milk; first-choice analgesic during lactation.',
    suggestedAlternatives: ['First-line choice'],
  },
  {
    id: 'folic-acid',
    genericName: 'Folic Acid / L-Methylfolate',
    aliases: ['folic acid', 'folvite', 'l-methylfolate', 'fol-5'],
    drugClass: 'Vitamin Supplement',
    fdaCategory: 'A',
    defaultRiskLevel: 'safe',
    mechanism: 'Essential cofactor in DNA synthesis and neural tube closure during embryonic development.',
    fetalRisks: 'Prevents neural tube defects (anencephaly, spina bifida) by up to 70%. Essential preconception and in T1.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Excreted in milk and recommended during lactation for maternal-infant health.',
    suggestedAlternatives: ['Universal recommendation (5mg daily in high risk, 0.4–1mg daily routine)'],
  },
  {
    id: 'iron-supplements',
    genericName: 'Iron (Ferrous Ascorbate, Ferrous Sulfate, Ferric Carboxymaltose)',
    aliases: ['ferrous ascorbate', 'ferrous sulfate', 'ferric carboxymaltose', 'orofer', 'autrin', 'fefol', 'fcm', 'injectafer'],
    drugClass: 'Hematopoietic Mineral',
    fdaCategory: 'A',
    defaultRiskLevel: 'safe',
    mechanism: 'Required for maternal hemoglobin expansion and fetal iron store accretion.',
    fetalRisks: 'Prevents maternal anemia, preterm birth, low birth weight, and fetal iron depletion.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Compatible with breastfeeding; actively supports maternal iron recovery.',
    suggestedAlternatives: ['First-line therapy for antenatal anemia'],
  },
  {
    id: 'calcium-vitamin-d',
    genericName: 'Calcium Carbonate + Vitamin D3',
    aliases: ['calcium', 'vitamin d3', 'cholecalciferol', 'shelcal', 'cipcal', 'calcimax'],
    drugClass: 'Mineral & Vitamin',
    fdaCategory: 'A',
    defaultRiskLevel: 'safe',
    mechanism: 'Essential for fetal skeletal mineralization and reduces risk of pre-eclampsia.',
    fetalRisks: 'Supports fetal skeletal growth and maternal bone preservation.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Safe and recommended during lactation.',
    suggestedAlternatives: ['Standard antenatal care supplementation (1–2g elemental calcium/day)'],
  },
  {
    id: 'doxylamine-pyridoxine',
    genericName: 'Doxylamine Succinate + Pyridoxine (Vitamin B6)',
    aliases: ['doxylamine', 'pyridoxine', 'doxinate', 'pregva', 'diclegis', 'bonjesta'],
    drugClass: 'Antiemetic (Antihistamine + Vitamin)',
    fdaCategory: 'A',
    defaultRiskLevel: 'safe',
    mechanism: 'Antagonizes H1 receptors with central vestibular anti-emetic action.',
    fetalRisks: 'Extensively studied; FDA approved Category A for nausea and vomiting in pregnancy (NVP).',
    lactationSafety: 'compatible',
    lactationAdvice: 'Compatible; monitor infant for mild sedation.',
    suggestedAlternatives: ['First-line for morning sickness / hyperemesis gravidarum'],
  },
  {
    id: 'labetalol',
    genericName: 'Labetalol',
    aliases: ['labetalol', 'labebet', 'gravidol', 'trandate'],
    drugClass: 'Alpha-Beta Adrenergic Blocker',
    fdaCategory: 'C',
    defaultRiskLevel: 'safe',
    mechanism: 'Selective alpha-1 and non-selective beta blocker; reduces systemic vascular resistance while preserving uteroplacental blood flow.',
    fetalRisks: 'First-line gold standard for gestational hypertension, pre-eclampsia, and chronic hypertension in pregnancy.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Very low excretion in breast milk; preferred beta-blocker during breastfeeding.',
    suggestedAlternatives: ['Methyldopa', 'Nifedipine'],
  },
  {
    id: 'methyldopa',
    genericName: 'Methyldopa',
    aliases: ['methyldopa', 'aldomet'],
    drugClass: 'Central Alpha-2 Agonist Antihypertensive',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    mechanism: 'Stimulates central alpha-2 receptors, decreasing sympathetic outflow.',
    fetalRisks: 'Decades of longitudinal pediatric safety follow-up through age 7 showing normal neurological development.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Safe during breastfeeding.',
    suggestedAlternatives: ['Labetalol', 'Nifedipine'],
  },
  {
    id: 'nifedipine',
    genericName: 'Nifedipine Retard',
    aliases: ['nifedipine', 'depin', 'calcigard', 'procardia', 'adalat'],
    drugClass: 'Calcium Channel Blocker (Dihydropyridine)',
    fdaCategory: 'C',
    defaultRiskLevel: 'safe',
    mechanism: 'Inhibits L-type calcium channels, causing arteriolar vasodilation and myometrial tocolysis.',
    fetalRisks: 'Extensively used and safe as both antihypertensive and acute tocolytic in preterm labor.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Negligible breast milk concentrations; compatible with breastfeeding.',
    suggestedAlternatives: ['Labetalol', 'Methyldopa'],
  },
  {
    id: 'amoxicillin-clavulanate',
    genericName: 'Amoxicillin + Clavulanic Acid',
    aliases: ['amoxicillin', 'clavulanic acid', 'augmentin', 'moxikind-cv', 'amoxyclav', 'clamox'],
    drugClass: 'Beta-Lactam Antibiotic',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    mechanism: 'Inhibits bacterial cell wall synthesis.',
    fetalRisks: 'Wide safety margin in all three trimesters; first-line antibiotic for respiratory and skin-soft tissue infections in pregnancy.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Safe in breastfeeding; monitor infant for loose stools or diaper candidiasis.',
    suggestedAlternatives: ['Cefuroxime', 'Azithromycin'],
  },
  {
    id: 'cephalosporins',
    genericName: 'Cephalosporins (Cefuroxime, Ceftriaxone, Cefixime, Cefalexin)',
    aliases: ['cefuroxime', 'ceftriaxone', 'cefixime', 'cefalexin', 'ceftum', 'monocef', 'zifi', 'sporidex'],
    drugClass: 'Cephalosporin Antibiotic',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    mechanism: 'Bactericidal cell wall inhibitor with negligible fetal toxicity.',
    fetalRisks: 'Standard safe antibiotic across all trimesters for urinary, respiratory, and surgical prophylaxis in obstetrics.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Compatible with breastfeeding.',
    suggestedAlternatives: ['First-line choice for bacterial infections'],
  },
  {
    id: 'enoxaparin-lmwh',
    genericName: 'Enoxaparin (Low Molecular Weight Heparin - LMWH)',
    aliases: ['enoxaparin', 'clexane', 'lonopin'],
    drugClass: 'Low Molecular Weight Heparin Anticoagulant',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    mechanism: 'Large polarized molecule does not cross the placental barrier; inhibits Factor Xa and thrombin.',
    fetalRisks: 'Gold-standard safe anticoagulant in pregnancy for VTE prevention/treatment and antiphospholipid syndrome. Zero teratogenicity.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Not orally bioavailable to the nursing infant; fully compatible with breastfeeding.',
    suggestedAlternatives: ['First-line choice for obstetric anticoagulation'],
  },
  {
    id: 'insulin',
    genericName: 'Human Insulin & Analogs (Regular, NPH, Aspart, Lispro)',
    aliases: ['insulin', 'human actrapid', 'insulatard', 'humalog', 'novorapid', 'lantus'],
    drugClass: 'Antidiabetic Peptide Hormone',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    mechanism: 'Promotes cellular glucose uptake. Large peptide hormone does not cross the placenta in significant amounts.',
    fetalRisks: 'Gold standard for maternal glycemic control in GDM and pregestational diabetes; prevents macrosomia and fetal demise.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Insulin is destroyed in the infant digestive tract; safe during breastfeeding.',
    suggestedAlternatives: ['First-line choice for diabetes in pregnancy'],
  },
  {
    id: 'levothyroxine',
    genericName: 'Levothyroxine',
    aliases: ['levothyroxine', 'thyronorm', 'eltroxin', 'synthroid'],
    drugClass: 'Thyroid Hormone',
    fdaCategory: 'A',
    defaultRiskLevel: 'safe',
    mechanism: 'Synthetic T4 essential for early fetal neuronal migration and cognitive development before fetal thyroid matures at 12–14 weeks.',
    fetalRisks: 'Crucial to maintain maternal euthyroidism; prevents spontaneous abortion, cretinism, and neurocognitive deficits.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Physiological hormone; safe and necessary during lactation.',
    suggestedAlternatives: ['Standard replacement therapy for hypothyroidism'],
  },
  {
    id: 'progesterone',
    genericName: 'Progesterone (Micronized / Dydrogesterone)',
    aliases: ['progesterone', 'dydrogesterone', 'gestofit', 'susten', 'duphaston'],
    drugClass: 'Progestogen',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    mechanism: 'Supports endometrial decidualization and myometrial quiescence.',
    fetalRisks: 'Safe for luteal support, threatened abortion, and prevention of recurrent preterm birth with short cervix.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Safe during breastfeeding.',
    suggestedAlternatives: ['Standard obstetric support'],
  },
  {
    id: 'ondansetron',
    genericName: 'Ondansetron',
    aliases: ['ondansetron', 'emset', 'zofran', 'vomikind'],
    drugClass: '5-HT3 Receptor Antagonist Antiemetic',
    fdaCategory: 'B',
    defaultRiskLevel: 'safe',
    trimesterSpecificRisk: {
      t1: { riskLevel: 'caution', warning: 'Conflicting data on very slight absolute risk of oral clefts if used before 10 weeks. Use Doxylamine+B6 as first-line; Ondansetron reserved for refractory hyperemesis.' },
      t2: { riskLevel: 'safe', warning: 'Safe second-line antiemetic for persistent nausea and vomiting.' },
      t3: { riskLevel: 'safe', warning: 'Safe for nausea and vomiting.' },
    },
    mechanism: 'Selective 5-HT3 receptor blocker.',
    fetalRisks: 'Overall wide safety record; reserve for refractory cases in first trimester after Doxylamine trial.',
    lactationSafety: 'compatible',
    lactationAdvice: 'Compatible with breastfeeding.',
    suggestedAlternatives: ['Doxylamine + Pyridoxine (first-line)', 'Metoclopramide'],
  },
];

export interface PrescriptionSafetyEvaluation {
  medicineName: string;
  ruleFound: boolean;
  matchedRule: MedicationSafetyRule | null;
  fdaCategory: FdaPregnancyCategory;
  evaluatedRiskLevel: MedicationRiskLevel;
  severityTitle: string;
  warningSummary: string;
  mechanism: string;
  fetalRisks: string;
  lactationSafety: LactationSafetyRating;
  lactationAdvice: string;
  suggestedAlternatives: string[];
}

/**
 * Searches the medication database by generic name or common brand aliases.
 */
export function findMedicationSafetyRule(query: string): MedicationSafetyRule | null {
  if (!query || typeof query !== 'string' || query.trim() === '') return null;
  const q = query.toLowerCase().trim();

  // 1. Direct or alias match
  for (const rule of PREGNANCY_MEDICATION_DATABASE) {
    if (rule.genericName.toLowerCase().includes(q)) return rule;
    if (rule.aliases.some((alias) => q.includes(alias) || alias.includes(q))) return rule;
  }

  // 2. Tokenized word search
  const tokens = q.split(/[\s,+/()\-]+/).filter((t) => t.length >= 3);
  for (const rule of PREGNANCY_MEDICATION_DATABASE) {
    for (const t of tokens) {
      if (rule.aliases.some((alias) => alias.toLowerCase() === t)) return rule;
      if (rule.genericName.toLowerCase().includes(t)) return rule;
    }
  }

  return null;
}

/**
 * Evaluates prescription safety considering gestational age (trimester-specific risks) and lactation.
 */
export function evaluatePrescriptionSafety(
  medicineName: string,
  gestationalAgeWeeks?: number | null,
  isLactating?: boolean
): PrescriptionSafetyEvaluation {
  const rule = findMedicationSafetyRule(medicineName);

  if (!rule) {
    return {
      medicineName,
      ruleFound: false,
      matchedRule: null,
      fdaCategory: 'N/A',
      evaluatedRiskLevel: 'caution',
      severityTitle: 'Unclassified / Clinical Discretion',
      warningSummary: 'No specific teratogenic contraindication found in knowledge base. Verify with standard obstetric pharmacopeia before prescribing.',
      mechanism: 'Unknown / Not indexed',
      fetalRisks: 'Safety in pregnancy not formally verified in clinic catalog.',
      lactationSafety: isLactating ? 'caution' : 'compatible',
      lactationAdvice: 'Assess infant risk-benefit before initiating.',
      suggestedAlternatives: [],
    };
  }

  let finalRiskLevel = rule.defaultRiskLevel;
  let warning = '';

  // Apply trimester-specific adjustments
  if (gestationalAgeWeeks != null) {
    let tri: 't1' | 't2' | 't3' = 't1';
    if (gestationalAgeWeeks >= 28) tri = 't3';
    else if (gestationalAgeWeeks >= 13) tri = 't2';

    const triRule = rule.trimesterSpecificRisk?.[tri];
    if (triRule) {
      finalRiskLevel = triRule.riskLevel;
      warning = triRule.warning;
    }
  }

  if (!warning) {
    if (finalRiskLevel === 'contraindicated') {
      warning = `CONTRAINDICATED in pregnancy (FDA Category ${rule.fdaCategory}). Severe teratogenic or fetotoxic hazards documented.`;
    } else if (finalRiskLevel === 'high_risk') {
      warning = `HIGH-RISK in pregnancy (FDA Category ${rule.fdaCategory}). Use only if life-threatening maternal indication and safe alternatives fail.`;
    } else if (finalRiskLevel === 'caution') {
      warning = `CAUTION in pregnancy (FDA Category ${rule.fdaCategory}). Monitor fetal well-being and use lowest effective dose.`;
    } else {
      warning = `SAFE in pregnancy (FDA Category ${rule.fdaCategory}). Standard first-line agent with documented clinical safety.`;
    }
  }

  const titleMap: Record<MedicationRiskLevel, string> = {
    contraindicated: '⛔ CONTRAINDICATED IN PREGNANCY',
    high_risk: '⚠️ HIGH FETAL RISK (CATEGORY D)',
    caution: '⚡ CAUTION / SURVEILLANCE INDICATED',
    safe: '✅ PREGNANCY SAFE (FIRST LINE)',
  };

  return {
    medicineName,
    ruleFound: true,
    matchedRule: rule,
    fdaCategory: rule.fdaCategory,
    evaluatedRiskLevel: finalRiskLevel,
    severityTitle: titleMap[finalRiskLevel],
    warningSummary: warning,
    mechanism: rule.mechanism,
    fetalRisks: rule.fetalRisks,
    lactationSafety: rule.lactationSafety,
    lactationAdvice: rule.lactationAdvice,
    suggestedAlternatives: rule.suggestedAlternatives,
  };
}

export function getRiskBadgeStyle(level: MedicationRiskLevel) {
  switch (level) {
    case 'contraindicated':
      return { background: '#fef2f2', color: '#991b1b', border: '1px solid #ef4444' };
    case 'high_risk':
      return { background: '#fff7ed', color: '#c2410c', border: '1px solid #f97316' };
    case 'caution':
      return { background: '#fffbeb', color: '#92400e', border: '1px solid #f59e0b' };
    case 'safe':
      return { background: '#f0fdf4', color: '#166534', border: '1px solid #22c55e' };
  }
}
