import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

export interface ProtocolItem {
  id: string;
  to: string;
  title: string;
  category: 'obstetric' | 'neonatal' | 'pediatric' | 'specialty';
  icon: string;
  badge?: string;
  urgency: 'immediate' | 'urgent' | 'routine';
  summary: string;
  keywords: string[];
}

export const CLINICAL_PROTOCOLS: ProtocolItem[] = [
  // --- OBSTETRICS & MATERNAL ---
  {
    id: 'obstetric-dic',
    to: '/obstetric-dic',
    title: 'Obstetric DIC & Fibrinogen-Guided Resuscitation',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 41',
    urgency: 'immediate',
    summary: 'Pregnancy-modified ISTH criteria, Fibrinogen target ≥ 200 mg/dL, Cryoprecipitate titration, and 1:1:1 balanced MTP bundle.',
    keywords: ['dic', 'obstetric dic', 'fibrinogen', 'cryoprecipitate', 'mtp', 'coagulopathy', 'series 41', 'obstetric'],
  },
  {
    id: 'fetal-hydrops',
    to: '/fetal-hydrops',
    title: 'Non-Immune Fetal Hydrops & Mirror Syndrome',
    category: 'obstetric',
    icon: '💧',
    badge: 'Series 40',
    urgency: 'urgent',
    summary: 'MCA Doppler peak systolic velocity > 1.5 MoM, fetal serous effusions, and maternal Ballantyne Mirror Syndrome surveillance.',
    keywords: ['fetal hydrops', 'mirror syndrome', 'mca psv', 'anemia', 'series 40', 'obstetric'],
  },
  {
    id: 'obstetric-cvst',
    to: '/obstetric-cvst',
    title: 'Obstetric Cerebral Venous Sinus Thrombosis (CVST)',
    category: 'obstetric',
    icon: '🧠',
    badge: 'Series 40',
    urgency: 'immediate',
    summary: 'Peripartum hypercoagulable headache/seizures, therapeutic UFH/LMWH anticoagulation, and intracranial hypertension management.',
    keywords: ['cvst', 'cerebral venous', 'thrombosis', 'headache', 'heparin', 'series 40', 'obstetric'],
  },
  {
    id: 'obstetric-massive-pe',
    to: '/obstetric-massive-pe',
    title: 'Obstetric Massive Pulmonary Embolism & RV Strain',
    category: 'obstetric',
    icon: '🫀',
    badge: 'Series 39',
    urgency: 'immediate',
    summary: 'Massive PE with RV strain, bedside echocardiography, urgent thrombolysis protocol (rtPA), and therapeutic UFH.',
    keywords: ['pulmonary embolism', 'pe', 'rv strain', 'thrombolysis', 'heparin', 'series 39', 'obstetric'],
  },
  {
    id: 'obstetric-pmcd',
    to: '/obstetric-pmcd',
    title: 'Perimortem Cesarean Delivery (PMCD)',
    category: 'obstetric',
    icon: '⚡',
    badge: 'Series 38',
    urgency: 'immediate',
    summary: 'Maternal cardiac arrest resuscitation: 4-minute resuscitation rule with delivery by 5 minutes for maternal-fetal survival.',
    keywords: ['pmcd', 'perimortem', 'cesarean', 'cardiac arrest', 'resuscitation', 'series 38', 'obstetric'],
  },
  {
    id: 'obstetric-hyperemesis',
    to: '/obstetric-hyperemesis',
    title: 'Hyperemesis Gravidarum & PUQE-24',
    category: 'obstetric',
    icon: '🤰',
    badge: 'Series 37',
    urgency: 'urgent',
    summary: 'PUQE-24 scoring, parenteral electrolyte & fluid rehydration, Wernicke thiamine prophylaxis, and stepped antiemetics.',
    keywords: ['hyperemesis', 'puqe', 'vomiting', 'thiamine', 'series 37', 'obstetric'],
  },
  {
    id: 'obstetric-hellp',
    to: '/obstetric-hellp',
    title: 'Obstetric HELLP Syndrome',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 36',
    urgency: 'immediate',
    summary: 'Mississippi & Tennessee criteria, microangiopathic hemolysis, AST > 70, platelets < 50k, and delivery timing.',
    keywords: ['hellp', 'preeclampsia', 'hemolysis', 'platelets', 'ast', 'series 36', 'obstetric'],
  },
  {
    id: 'obstetric-spt',
    to: '/obstetric-spt',
    title: 'Septic Pelvic Thrombophlebitis (SPT)',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 35',
    urgency: 'urgent',
    summary: 'Persistent postpartum fever refractory to antibiotics, therapeutic heparin trial, and ovarian vein thrombosis surveillance.',
    keywords: ['spt', 'septic pelvic', 'thrombophlebitis', 'heparin', 'postpartum fever', 'series 35', 'obstetric'],
  },
  {
    id: 'obstetric-vasa-previa',
    to: '/obstetric-vasa-previa',
    title: 'Obstetric Vasa Previa Management',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 34',
    urgency: 'immediate',
    summary: 'Type I / II velamentous vessels over internal os, color Doppler screening, and planned 34-36 week cesarean delivery.',
    keywords: ['vasa previa', 'aberrant vessels', 'hemorrhage', 'series 34', 'obstetric'],
  },
  {
    id: 'obstetric-placental-abruption',
    to: '/obstetric-placental-abruption',
    title: 'Placental Abruption Emergency',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 33',
    urgency: 'immediate',
    summary: 'Page grading, dark vaginal bleeding, uterine hypertonus/rigidity, DIC surveillance, and rapid emergency delivery.',
    keywords: ['placental abruption', 'abruptio', 'uterine hypertonicity', 'dic', 'series 33', 'obstetric'],
  },
  {
    id: 'obstetric-ecv',
    to: '/obstetric-ecv',
    title: 'External Cephalic Version (ECV)',
    category: 'obstetric',
    icon: '🔄',
    badge: 'Series 32',
    urgency: 'routine',
    summary: '36-37 week breech to vertex conversion protocol, tocolytic preparation, ultrasound monitoring, and anti-D administration.',
    keywords: ['ecv', 'breech', 'version', 'tocolysis', 'series 32', 'obstetric'],
  },
  {
    id: 'obstetric-tolac',
    to: '/obstetric-tolac',
    title: 'Obstetric TOLAC & Rupture Protocol',
    category: 'obstetric',
    icon: '🤰',
    badge: 'Series 31',
    urgency: 'urgent',
    summary: 'Trial of labor after cesarean, Flamm & Geiger success scoring, uterine rupture surveillance, and rapid operative readiness.',
    keywords: ['tolac', 'vbac', 'uterine rupture', 'scar dehiscence', 'series 31', 'obstetric'],
  },
  {
    id: 'obstetric-retained-placenta',
    to: '/obstetric-retained-placenta',
    title: 'Retained Placenta Protocol',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 30',
    urgency: 'urgent',
    summary: '30-minute threshold, intraumbilical vein oxytocin injection, manual removal of placenta under anesthesia, and antibiotic coverage.',
    keywords: ['retained placenta', 'intraumbilical oxytocin', 'manual removal', 'series 30', 'obstetric'],
  },
  {
    id: 'obstetric-pdph',
    to: '/obstetric-pdph',
    title: 'Post-Dural Puncture Headache (PDPH)',
    category: 'obstetric',
    icon: '💉',
    badge: 'Series 29',
    urgency: 'routine',
    summary: 'Lybecker scoring, postural orthostatic cephalea post-spinal/epidural, conservative therapy, and epidural blood patch.',
    keywords: ['pdph', 'dural puncture', 'blood patch', 'epidural headache', 'series 29', 'obstetric'],
  },
  {
    id: 'obstetric-uterine-inversion',
    to: '/obstetric-uterine-inversion',
    title: 'Acute Uterine Inversion Emergency',
    category: 'obstetric',
    icon: '⚡',
    badge: 'Series 28',
    urgency: 'immediate',
    summary: 'Immediate Johnson maneuver manual replacement, uterine relaxants (terbutaline/nitroglycerin), and post-replacement uterotonics.',
    keywords: ['uterine inversion', 'johnson maneuver', 'shock', 'series 28', 'obstetric'],
  },
  {
    id: 'obstetric-cord-prolapse',
    to: '/obstetric-cord-prolapse',
    title: 'Umbilical Cord Prolapse Emergency',
    category: 'obstetric',
    icon: '🚨',
    badge: 'Series 27',
    urgency: 'immediate',
    summary: 'Manual presenting part elevation, knee-chest / exaggerated Trendelenburg position, bladder filling, and Category 1 LSCS.',
    keywords: ['cord prolapse', 'fetal bradycardia', 'emergency lscs', 'series 27', 'obstetric'],
  },
  {
    id: 'obstetric-ppcm',
    to: '/obstetric-ppcm',
    title: 'Peripartum Cardiomyopathy (PPCM)',
    category: 'obstetric',
    icon: '🫀',
    badge: 'Series 26',
    urgency: 'immediate',
    summary: 'Echocardiographic LVEF < 45%, BOARD regimen (Bromocriptine, Oral heart failure therapy, Anticoagulation), and ICU transfer.',
    keywords: ['ppcm', 'cardiomyopathy', 'heart failure', 'bromocriptine', 'series 26', 'obstetric'],
  },
  {
    id: 'obstetric-shoulder-dystocia',
    to: '/obstetric-shoulder-dystocia',
    title: 'Shoulder Dystocia HELPERR Protocol',
    category: 'obstetric',
    icon: '🚨',
    badge: 'Series 25',
    urgency: 'immediate',
    summary: 'Time-stamped HELPERR protocol: McRoberts maneuver, suprapubic pressure, Wood screw, posterior arm delivery, and episiotomy.',
    keywords: ['shoulder dystocia', 'helperr', 'mcroberts', 'rubin', 'series 25', 'obstetric'],
  },
  {
    id: 'obstetric-postterm',
    to: '/obstetric-postterm',
    title: 'Obstetric Post-Term Pregnancy',
    category: 'obstetric',
    icon: '🩺',
    badge: 'Series 24',
    urgency: 'routine',
    summary: '41+0 to 42+0 week fetal surveillance, modified biophysical profile, amniotic fluid MVP, and cervical ripening induction.',
    keywords: ['postterm', 'prolonged pregnancy', 'induction', 'biophysical profile', 'series 24', 'obstetric'],
  },
  {
    id: 'obstetric-pprom',
    to: '/obstetric-pprom',
    title: 'Preterm PROM (PPROM) Protocol',
    category: 'obstetric',
    icon: '🩺',
    badge: 'Series 23',
    urgency: 'urgent',
    summary: 'Latency antibiotic regimen (oral erythromycin/ampicillin), antenatal corticosteroids, MgSO4 neuroprotection, and chorioamnionitis signs.',
    keywords: ['pprom', 'premature rupture', 'latency antibiotics', 'steroids', 'series 23', 'obstetric'],
  },
  {
    id: 'obstetric-dka',
    to: '/obstetric-dka',
    title: 'Obstetric Diabetic Ketoacidosis (DKA)',
    category: 'obstetric',
    icon: '🩺',
    badge: 'Series 22',
    urgency: 'immediate',
    summary: 'Euglycemic DKA recognition, fixed-rate insulin infusion, potassium maintenance, fluid deficit calculation, and fetal heart monitoring.',
    keywords: ['obstetric dka', 'euglycemic dka', 'insulin infusion', 'series 22', 'obstetric'],
  },
  {
    id: 'obstetric-aflp',
    to: '/obstetric-aflp',
    title: 'Acute Fatty Liver of Pregnancy (AFLP)',
    category: 'obstetric',
    icon: '🩺',
    badge: 'Series 21',
    urgency: 'immediate',
    summary: 'Swansea diagnostic criteria (>= 6 features), microvesicular steatosis, coagulopathy, hypoglycemia correction, and urgent delivery.',
    keywords: ['aflp', 'swansea', 'fatty liver', 'hypoglycemia', 'series 21', 'obstetric'],
  },
  {
    id: 'obstetric-afe',
    to: '/obstetric-afe',
    title: 'Amniotic Fluid Embolism (AFE)',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 20',
    urgency: 'immediate',
    summary: 'Clark diagnostic criteria, sudden cardiovascular collapse, consumptive coagulopathy, and AOK regimen (Atropine, Ondansetron, Ketorolac).',
    keywords: ['afe', 'amniotic fluid embolism', 'aok protocol', 'coagulopathy', 'series 20', 'obstetric'],
  },
  {
    id: 'obstetric-pas',
    to: '/obstetric-pas',
    title: 'Placenta Accreta Spectrum (PAS)',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 19',
    urgency: 'urgent',
    summary: 'FIGO PAS classification (Accreta, Increta, Percreta), multidisciplinary surgical bundle, internal iliac artery control, and massive transfusion.',
    keywords: ['pas', 'placenta accreta', 'increta', 'percreta', 'series 19', 'obstetric'],
  },
  {
    id: 'obstetric-icp',
    to: '/obstetric-icp',
    title: 'Obstetric Intrahepatic Cholestasis (ICP)',
    category: 'obstetric',
    icon: '🧪',
    badge: 'Series 18',
    urgency: 'routine',
    summary: 'Total serum bile acids grading (Mild 10-39, Moderate 40-99, Severe >= 100 µmol/L), Ursodeoxycholic acid (UDCA), and delivery timing.',
    keywords: ['icp', 'cholestasis', 'bile acids', 'udca', 'pruritus', 'series 18', 'obstetric'],
  },
  {
    id: 'obstetric-pph',
    to: '/obstetric-pph',
    title: 'Obstetric Postpartum Hemorrhage (PPH)',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 17',
    urgency: 'immediate',
    summary: '4Ts etiology algorithm, Shock Index calculation, bimanual compression, tranexamic acid, uterotonics, and Bakri balloon tamponade.',
    keywords: ['pph', 'postpartum hemorrhage', 'shock index', 'oxytocin', 'bakri', 'series 17', 'obstetric'],
  },
  {
    id: 'obstetric-hypertension',
    to: '/obstetric-hypertension',
    title: 'Severe Obstetric Hypertension & Eclampsia',
    category: 'obstetric',
    icon: '⚡',
    badge: 'Series 16',
    urgency: 'immediate',
    summary: 'Emergency BP control within 30-60 min (IV Labetalol, Hydralazine, oral Nifedipine), MgSO4 eclampsia prophylaxis, and maternal stabilization.',
    keywords: ['hypertension', 'preeclampsia', 'eclampsia', 'labetalol', 'nifedipine', 'series 16', 'obstetric'],
  },
  {
    id: 'maternal-vte',
    to: '/maternal-vte',
    title: 'Maternal VTE Risk Assessment & Thromboprophylaxis',
    category: 'obstetric',
    icon: '🩸',
    badge: 'Series 15',
    urgency: 'routine',
    summary: 'RCOG Green-top guideline 37a antenatal and postnatal scoring, weight-adjusted LMWH dosing, and bleeding risk check.',
    keywords: ['vte', 'dvt', 'thromboprophylaxis', 'lmwh', 'enoxaparin', 'rcog', 'series 15', 'obstetric'],
  },
  {
    id: 'maternal-sepsis',
    to: '/maternal-sepsis',
    title: 'Maternal Sepsis & Obstetric qSOFA',
    category: 'obstetric',
    icon: '🚨',
    badge: 'Series 14',
    urgency: 'immediate',
    summary: 'Obstetric-modified qSOFA (RR >= 25, SBP <= 90, altered mentation), Sepsis Six care bundle, and broad-spectrum IV antimicrobials within 1 hr.',
    keywords: ['sepsis', 'maternal sepsis', 'qsofa', 'sepsis six', 'lactate', 'series 14', 'obstetric'],
  },
  {
    id: 'maternal-comorbidities',
    to: '/maternal-comorbidities',
    title: 'Maternal Medical Comorbidities Risk Scoring',
    category: 'obstetric',
    icon: '🤰',
    badge: 'Series 13',
    urgency: 'routine',
    summary: 'Systemic evaluation: preexisting cardiac disease (mWHO), chronic hypertension, pregestational diabetes, SLE, and chronic kidney disease.',
    keywords: ['comorbidities', 'cardiac', 'lupus', 'chronic hypertension', 'mwho', 'series 13', 'obstetric'],
  },
  {
    id: 'obstetric-hdu',
    to: '/obstetric-hdu',
    title: 'Obstetric HDU & Zuspan MgSO4 Protocol',
    category: 'obstetric',
    icon: '🤰',
    badge: 'Critical Care',
    urgency: 'immediate',
    summary: 'Zuspan IV magnesium sulfate protocol: 4g IV loading dose, 1g/hr maintenance, hourly patellar reflex, RR, and 10% Calcium Gluconate antidote.',
    keywords: ['hdu', 'mgso4', 'magnesium', 'zuspan', 'calcium gluconate', 'obstetric'],
  },

  // --- NEONATAL & NICU ---
  {
    id: 'neonatal-seizures',
    to: '/neonatal-seizures',
    title: 'Neonatal Seizures & Status Epilepticus Pathway',
    category: 'neonatal',
    icon: '⚡',
    badge: 'Series 41',
    urgency: 'immediate',
    summary: 'WHO 2023 / ILAE semiology, weight-based Phenobarbital loading (20 mg/kg), second-line ASM, B6 trial, and emergency metabolic correction.',
    keywords: ['neonatal seizures', 'status epilepticus', 'phenobarbital', 'levetiracetam', 'pyridoxine', 'series 41', 'neonatal'],
  },
  {
    id: 'neonatal-hyperammonemia',
    to: '/neonatal-hyperammonemia',
    title: 'Neonatal Inborn Error Hyperammonemia',
    category: 'neonatal',
    icon: '🧬',
    badge: 'Series 39',
    urgency: 'immediate',
    summary: 'Ammonia > 100/150 µmol/L inborn error emergency: protein cessation, 10% Dextrose, Sodium Benzoate/Phenylbutyrate, and urgent dialysis prep.',
    keywords: ['hyperammonemia', 'ammonia', 'inborn errors', 'iem', 'sodium benzoate', 'series 39', 'neonatal'],
  },
  {
    id: 'neonatal-sip',
    to: '/neonatal-sip',
    title: 'Neonatal Spontaneous Intestinal Perforation (SIP)',
    category: 'neonatal',
    icon: '🍼',
    badge: 'Series 38',
    urgency: 'immediate',
    summary: 'ELBW infant isolated pneumoperitoneum without pneumatosis, bluish abdominal wall discoloration, and bedside peritoneal drain vs laparotomy.',
    keywords: ['sip', 'perforation', 'pneumoperitoneum', 'elbw', 'series 38', 'neonatal'],
  },
  {
    id: 'neonatal-cdh',
    to: '/neonatal-cdh',
    title: 'Neonatal Congenital Diaphragmatic Hernia (CDH)',
    category: 'neonatal',
    icon: '🫁',
    badge: 'Series 37',
    urgency: 'immediate',
    summary: 'Gentle ventilation protocol: immediate intubation without bag-mask, pre-ductal SpO2 85-95%, NGT suction, and pulmonary hypertension care.',
    keywords: ['cdh', 'diaphragmatic hernia', 'gentle ventilation', 'scaphoid abdomen', 'series 37', 'neonatal'],
  },
  {
    id: 'neonatal-intestinal-atresia',
    to: '/neonatal-intestinal-atresia',
    title: 'Neonatal Intestinal Atresia Protocol',
    category: 'neonatal',
    icon: '👶',
    badge: 'Series 36',
    urgency: 'urgent',
    summary: 'Duodenal (double bubble) & jejunoileal atresia: bilious gastric aspirates, continuous NGT decompression, and fluid-electrolyte restoration.',
    keywords: ['intestinal atresia', 'duodenal atresia', 'double bubble', 'bilious', 'series 36', 'neonatal'],
  },
  {
    id: 'neonatal-abdominal-defects',
    to: '/neonatal-abdominal-defects',
    title: 'Abdominal Wall Defects: Gastroschisis & Omphalocele',
    category: 'neonatal',
    icon: '👶',
    badge: 'Series 35',
    urgency: 'immediate',
    summary: 'Sterile bowel bag containment, spring-loaded silo reduction, avoid gut twisting, fluid resuscitation (1.5x maintenance), and surgical closure.',
    keywords: ['gastroschisis', 'omphalocele', 'silo', 'bowel bag', 'series 35', 'neonatal'],
  },
  {
    id: 'neonatal-ea-tef',
    to: '/neonatal-ea-tef',
    title: 'Esophageal Atresia & TEF Protocol',
    category: 'neonatal',
    icon: '🫁',
    badge: 'Series 34',
    urgency: 'immediate',
    summary: 'Replogle tube continuous sump suction, 30° head-up positioning, avoid positive-pressure mask ventilation, and VACTERL screening.',
    keywords: ['esophageal atresia', 'tef', 'replogle', 'vacterl', 'series 34', 'neonatal'],
  },
  {
    id: 'neonatal-meconium-ileus',
    to: '/neonatal-meconium-ileus',
    title: 'Meconium Ileus & Cystic Fibrosis',
    category: 'neonatal',
    icon: '🍼',
    badge: 'Series 33',
    urgency: 'urgent',
    summary: 'Soap-bubble appearance (Neuhauser sign), diagnostic & therapeutic water-soluble Gastrografin enema, and sweat chloride test planning.',
    keywords: ['meconium ileus', 'cystic fibrosis', 'gastrografin', 'soap bubble', 'series 33', 'neonatal'],
  },
  {
    id: 'neonatal-volvulus',
    to: '/neonatal-volvulus',
    title: 'Neonatal Malrotation with Midgut Volvulus',
    category: 'neonatal',
    icon: '🌀',
    badge: 'Series 32',
    urgency: 'immediate',
    summary: 'Surgical emergency in any infant with sudden bilious vomiting: upper GI series corkscrew sign, fluid resuscitation, and emergency Ladd procedure.',
    keywords: ['volvulus', 'malrotation', 'bilious vomiting', 'ladd procedure', 'series 32', 'neonatal'],
  },
  {
    id: 'neonatal-sgh',
    to: '/neonatal-sgh',
    title: 'Subgaleal Hemorrhage (SGH) Resuscitation',
    category: 'neonatal',
    icon: '🩸',
    badge: 'Series 31',
    urgency: 'immediate',
    summary: 'Vacuum/instrumental delivery scalp fluctuance crossing sutures, serial head circumference, rapid hypovolemic shock resuscitation, and blood products.',
    keywords: ['sgh', 'subgaleal hemorrhage', 'scalp swelling', 'hypovolemic shock', 'series 31', 'neonatal'],
  },
  {
    id: 'neonatal-aop',
    to: '/neonatal-aop',
    title: 'Apnea of Prematurity (AOP)',
    category: 'neonatal',
    icon: '🫁',
    badge: 'Series 30',
    urgency: 'routine',
    summary: 'Cessation of breathing > 20s or with bradycardia/desaturation, Caffeine Citrate loading (20 mg/kg) & daily maintenance, and tactile stimulation.',
    keywords: ['aop', 'apnea of prematurity', 'caffeine citrate', 'bradycardia', 'series 30', 'neonatal'],
  },
  {
    id: 'neonatal-ttn',
    to: '/neonatal-ttn',
    title: 'Transient Tachypnea of the Newborn (TTN)',
    category: 'neonatal',
    icon: '🫁',
    badge: 'Series 29',
    urgency: 'routine',
    summary: 'Delayed fetal lung fluid clearance, perihilar streaking and interlobar fluid, humidified nasal cannula / CPAP support, and monitoring.',
    keywords: ['ttn', 'transient tachypnea', 'wet lung', 'cpap', 'series 29', 'neonatal'],
  },
  {
    id: 'neonatal-mas',
    to: '/neonatal-mas',
    title: 'Meconium Aspiration Syndrome (MAS)',
    category: 'neonatal',
    icon: '💨',
    badge: 'Series 28',
    urgency: 'urgent',
    summary: 'Chemical pneumonitis & airway obstruction, surfactant lavage/replacement, PPHN surveillance, and avoidance of hyperoxia.',
    keywords: ['mas', 'meconium aspiration', 'chemical pneumonitis', 'surfactant', 'series 28', 'neonatal'],
  },
  {
    id: 'neonatal-chylothorax',
    to: '/neonatal-chylothorax',
    title: 'Congenital & Postoperative Chylothorax',
    category: 'neonatal',
    icon: '🫁',
    badge: 'Series 27',
    urgency: 'urgent',
    summary: 'Pleural effusion triglycerides > 110 mg/dL, lymphocyte predominance, medium-chain triglyceride (MCT) enteral feeds, and Octreotide infusion.',
    keywords: ['chylothorax', 'pleural effusion', 'octreotide', 'mct diet', 'series 27', 'neonatal'],
  },
  {
    id: 'neonatal-hypomagnesemia',
    to: '/neonatal-hypomagnesemia',
    title: 'Neonatal Hypomagnesemia Protocol',
    category: 'neonatal',
    icon: '⚡',
    badge: 'Series 26',
    urgency: 'urgent',
    summary: 'Serum Mg < 1.5 mg/dL with refractory hypocalcemia, 50% MgSO4 0.1-0.2 mL/kg slow IV infusion over 1 hour with ECG surveillance.',
    keywords: ['hypomagnesemia', 'magnesium', 'tetany', 'hypocalcemia', 'series 26', 'neonatal'],
  },
  {
    id: 'neonatal-polycythemia',
    to: '/neonatal-polycythemia',
    title: 'Neonatal Polycythemia & Partial Exchange',
    category: 'neonatal',
    icon: '🩸',
    badge: 'Series 25',
    urgency: 'urgent',
    summary: 'Venous hematocrit >= 65%, partial volume exchange transfusion (PET) calculation with normal saline to target Hct 55%, and hyperviscosity relief.',
    keywords: ['polycythemia', 'hematocrit', 'partial exchange', 'hyperviscosity', 'series 25', 'neonatal'],
  },
  {
    id: 'neonatal-hypocalcemia',
    to: '/neonatal-hypocalcemia',
    title: 'Neonatal Hypocalcemia Protocol',
    category: 'neonatal',
    icon: '🧪',
    badge: 'Series 24',
    urgency: 'urgent',
    summary: 'Ionized Calcium < 1.0 mmol/L, 10% Calcium Gluconate slow IV infusion with continuous heart rate monitoring, and extravasation precaution.',
    keywords: ['hypocalcemia', 'calcium gluconate', 'tetany', 'seizures', 'series 24', 'neonatal'],
  },
  {
    id: 'neonatal-ivh',
    to: '/neonatal-ivh',
    title: 'Neonatal Intraventricular Hemorrhage (IVH)',
    category: 'neonatal',
    icon: '🧠',
    badge: 'Series 23',
    urgency: 'urgent',
    summary: 'Papile classification (Grade I-IV), serial cranial ultrasonography, neutral head alignment, gentle handling, and post-hemorrhagic hydrocephalus tracking.',
    keywords: ['ivh', 'intraventricular hemorrhage', 'papile', 'germinal matrix', 'series 23', 'neonatal'],
  },
  {
    id: 'neonatal-hspda',
    to: '/neonatal-hspda',
    title: 'Hemodynamically Significant PDA (hsPDA)',
    category: 'neonatal',
    icon: '🫀',
    badge: 'Series 22',
    urgency: 'urgent',
    summary: 'LA:Ao ratio > 1.4, retrograde descending aorta diastolic flow, medical closure with oral Paracetamol or IV Ibuprofen, and fluid restriction.',
    keywords: ['pda', 'hspda', 'ductus arteriosus', 'paracetamol', 'ibuprofen', 'series 22', 'neonatal'],
  },
  {
    id: 'neonatal-bpd',
    to: '/neonatal-bpd',
    title: 'Neonatal Bronchopulmonary Dysplasia (BPD)',
    category: 'neonatal',
    icon: '🫁',
    badge: 'Series 21',
    urgency: 'routine',
    summary: 'Jensen / NIH 2019 criteria at 36 weeks PMA, post-surfactant lung injury scoring, caffeine continuation, and lung-protective ventilatory weaning.',
    keywords: ['bpd', 'bronchopulmonary dysplasia', 'chronic lung disease', 'series 21', 'neonatal'],
  },
  {
    id: 'neonatal-pphn',
    to: '/neonatal-pphn',
    title: 'Neonatal PPHN & Pulmonary Vasodilators',
    category: 'neonatal',
    icon: '🫁',
    badge: 'Series 20',
    urgency: 'immediate',
    summary: 'Persistent pulmonary hypertension: pre/post-ductal SpO2 gradient > 10%, Inhaled Nitric Oxide (iNO) 20 ppm, Milrinone, and Sildenafil.',
    keywords: ['pphn', 'pulmonary hypertension', 'nitric oxide', 'milrinone', 'series 20', 'neonatal'],
  },
  {
    id: 'neonatal-nec',
    to: '/neonatal-nec',
    title: 'Neonatal Necrotizing Enterocolitis (NEC)',
    category: 'neonatal',
    icon: '🫄',
    badge: 'Series 19',
    urgency: 'immediate',
    summary: 'Modified Bell staging criteria (Stage I to III), abdominal distension, pneumatosis intestinalis, portal venous gas, bowel rest, and surgical review.',
    keywords: ['nec', 'necrotizing enterocolitis', 'bell staging', 'pneumatosis', 'series 19', 'neonatal'],
  },
  {
    id: 'neonatal-bind-aabr',
    to: '/neonatal-bind-aabr',
    title: 'Neonatal Hyperbilirubinemia & BIND / AABR',
    category: 'neonatal',
    icon: '👂',
    badge: 'Series 18',
    urgency: 'urgent',
    summary: 'AAP 2022 hour-specific phototherapy and exchange transfusion nomograms, BIND neurotoxicity score, and Automated ABR hearing screen.',
    keywords: ['jaundice', 'hyperbilirubinemia', 'bind', 'aabr', 'exchange transfusion', 'series 18', 'neonatal'],
  },
  {
    id: 'neonatal-hypoglycemia',
    to: '/neonatal-hypoglycemia',
    title: 'Neonatal Hypoglycemia Algorithm',
    category: 'neonatal',
    icon: '🍼',
    badge: 'Series 17',
    urgency: 'immediate',
    summary: 'AAP/PES thresholds (< 40-45 mg/dL), Mini-bolus 10% Dextrose 2 mL/kg, glucose infusion rate (GIR 4-8 mg/kg/min) titration, and glucagon protocol.',
    keywords: ['hypoglycemia', 'neonatal glucose', 'gir', 'dextrose', 'series 17', 'neonatal'],
  },
  {
    id: 'neonatal-sepsis',
    to: '/neonatal-sepsis',
    title: 'Neonatal Early & Late Onset Sepsis',
    category: 'neonatal',
    icon: '👶',
    badge: 'Series 16',
    urgency: 'immediate',
    summary: 'Kaiser Permanente EOS risk calculator, maternal GBS/PROM risk factors, empiric Ampicillin + Gentamicin within 1 hour, and CRP/micro-ESR.',
    keywords: ['neonatal sepsis', 'kaiser sepsis', 'eos', 'los', 'ampicillin', 'gentamicin', 'series 16', 'neonatal'],
  },
  {
    id: 'neonatal-rds',
    to: '/neonatal-rds',
    title: 'Neonatal RDS & Surfactant Replacement',
    category: 'neonatal',
    icon: '🫁',
    badge: 'Series 15',
    urgency: 'immediate',
    summary: 'Silverman-Anderson respiratory severity score, early bubble CPAP, INSURE / LISA non-invasive surfactant delivery (200 mg/kg Poractant alfa).',
    keywords: ['rds', 'respiratory distress', 'surfactant', 'lisa', 'insure', 'cpap', 'series 15', 'neonatal'],
  },
  {
    id: 'neonatal-hie',
    to: '/neonatal-hie',
    title: 'Neonatal HIE & Therapeutic Hypothermia',
    category: 'neonatal',
    icon: '🧊',
    badge: 'Series 14',
    urgency: 'immediate',
    summary: 'Modified Sarnat staging for moderate/severe encephalopathy, 72-hour whole body cooling to 33.5°C, continuous core temp, and slow 0.5°C/hr rewarming.',
    keywords: ['hie', 'cooling', 'therapeutic hypothermia', 'sarnat', 'asphyxia', 'series 14', 'neonatal'],
  },
  {
    id: 'nicu-tpn',
    to: '/nicu-tpn',
    title: 'NICU Total Parenteral Nutrition (TPN)',
    category: 'neonatal',
    icon: '🧪',
    badge: 'Specialty',
    urgency: 'routine',
    summary: 'Automated NICU neonatal TPN prescription: fluid volume (mL/kg/day), GIR (mg/kg/min), amino acid titration (1.5-3.5 g/kg/d), and 20% lipid emulsion.',
    keywords: ['tpn', 'parenteral nutrition', 'nicu', 'gir', 'amino acids', 'lipids', 'neonatal'],
  },

  // --- PEDIATRIC & PICU ---
  {
    id: 'pediatric-acute-liver-failure',
    to: '/palf',
    title: 'Pediatric Acute Liver Failure (PALF) & Neuroprotection',
    category: 'pediatric',
    icon: '🫀',
    badge: 'Series 41',
    urgency: 'immediate',
    summary: 'PALF Study Group criteria, King\'s College transplant prognostic scoring, 3% Hypertonic Saline, Mannitol, IV NAC, and ammonia clearance.',
    keywords: ['palf', 'liver failure', 'hepatic encephalopathy', 'kings college', 'hypertonic saline', 'nac', 'series 41', 'pediatric'],
  },
  {
    id: 'pediatric-refractory-asthma',
    to: '/pediatric-refractory-asthma',
    title: 'Pediatric Refractory Asthma (PICU)',
    category: 'pediatric',
    icon: '🫁',
    badge: 'Series 40',
    urgency: 'immediate',
    summary: 'GINA/BTS refractory acute severe asthma: continuous nebulized salbutamol + ipratropium, IV MgSO4, IV Terbutaline, Ketamine, and BiPAP/HFNC.',
    keywords: ['refractory asthma', 'status asthmaticus', 'terbutaline', 'magnesium', 'picu', 'series 40', 'pediatric'],
  },
  {
    id: 'pediatric-toxicology',
    to: '/pediatric-toxicology',
    title: 'Pediatric Acute Toxic Ingestion & Antidotes',
    category: 'pediatric',
    icon: '🧪',
    badge: 'Series 39',
    urgency: 'immediate',
    summary: 'Toxidrome recognition: Acetaminophen (Rumack-Matthew / NAC), Iron (deferoxamine), Opioids (naloxone), Organophosphates (atropine), and Caustic ingestion.',
    keywords: ['toxicology', 'poisoning', 'paracetamol', 'antidotes', 'naloxone', 'nac', 'series 39', 'pediatric'],
  },
  {
    id: 'pediatric-gbs',
    to: '/pediatric-gbs',
    title: 'Pediatric Guillain-Barré Syndrome (GBS)',
    category: 'pediatric',
    icon: '🧠',
    badge: 'Series 38',
    urgency: 'urgent',
    summary: 'Brighton diagnostic criteria: acute ascending flaccid paralysis, albuminocytologic dissociation, IVIG 2 g/kg, and vital capacity monitoring.',
    keywords: ['gbs', 'guillain barre', 'brighton', 'ivig', 'ascending paralysis', 'series 38', 'pediatric'],
  },
  {
    id: 'pediatric-acute-scrotum',
    to: '/pediatric-acute-scrotum',
    title: 'Pediatric Acute Scrotum & TWIST Score',
    category: 'pediatric',
    icon: '🩻',
    badge: 'Series 37',
    urgency: 'immediate',
    summary: 'TWIST scoring (0-7): Testicular torsion vs epididymitis / torsion of appendix testis, urgent Doppler ultrasound, and 6-hour salvage window exploration.',
    keywords: ['acute scrotum', 'testicular torsion', 'twist score', 'epididymitis', 'series 37', 'pediatric'],
  },
  {
    id: 'pediatric-scfe',
    to: '/pediatric-scfe',
    title: 'Slipped Capital Femoral Epiphysis (SCFE)',
    category: 'pediatric',
    icon: '🦴',
    badge: 'Series 36',
    urgency: 'urgent',
    summary: 'Loder classification (stable vs unstable), Klein line on AP & frog-leg pelvis radiographs, strict non-weight bearing, and urgent orthopedic pinning.',
    keywords: ['scfe', 'loder', 'hip pain', 'epiphysis', 'klein line', 'series 36', 'pediatric'],
  },
  {
    id: 'pediatric-osteomyelitis',
    to: '/pediatric-osteomyelitis',
    title: 'Pediatric Acute Hematogenous Osteomyelitis',
    category: 'pediatric',
    icon: '🦴',
    badge: 'Series 35',
    urgency: 'urgent',
    summary: 'Localized bone tenderness & refusal to bear weight, serial CRP/ESR trends, MRI evaluation, targeted IV anti-staphylococcal therapy, and drainage.',
    keywords: ['osteomyelitis', 'bone infection', 'crp', 'staphylococcus', 'series 35', 'pediatric'],
  },
  {
    id: 'pediatric-empyema',
    to: '/pediatric-empyema',
    title: 'Pediatric Empyema & Parapneumonic Effusion',
    category: 'pediatric',
    icon: '🫁',
    badge: 'Series 34',
    urgency: 'urgent',
    summary: 'BTS guidelines: pleural fluid pH < 7.2, loculations on ultrasound, chest tube drainage with intrapleural fibrinolytics (tPA + DNase) vs VATS.',
    keywords: ['empyema', 'parapneumonic', 'pleural effusion', 'fibrinolytics', 'series 34', 'pediatric'],
  },
  {
    id: 'pediatric-hus',
    to: '/pediatric-hus',
    title: 'Pediatric Hemolytic Uremic Syndrome (HUS)',
    category: 'pediatric',
    icon: '🔬',
    badge: 'Series 33',
    urgency: 'immediate',
    summary: 'STEC-associated triad: microangiopathic hemolytic anemia, thrombocytopenia, and acute kidney injury. Fluid management and avoidance of antibiotics.',
    keywords: ['hus', 'hemolytic uremic', 'stec', 'aki', 'thrombocytopenia', 'series 33', 'pediatric'],
  },
  {
    id: 'pediatric-dka-ce',
    to: '/pediatric-dka-ce',
    title: 'Pediatric DKA Cerebral Edema Emergency',
    category: 'pediatric',
    icon: '🧠',
    badge: 'Series 32',
    urgency: 'immediate',
    summary: 'Muir clinical criteria for DKA cerebral edema: immediate Hypertonic Saline 3% (3-5 mL/kg) or Mannitol (0.5-1 g/kg), elevate head 30°, and reduce fluids.',
    keywords: ['dka cerebral edema', 'muir criteria', 'hypertonic saline', 'mannitol', 'series 32', 'pediatric'],
  },
  {
    id: 'pediatric-kawasaki',
    to: '/pediatric-kawasaki',
    title: 'Kawasaki Disease & Incomplete Kawasaki',
    category: 'pediatric',
    icon: '❤️',
    badge: 'Series 31',
    urgency: 'urgent',
    summary: 'AHA diagnostic criteria: fever >= 5 days plus 4 of 5 principal signs, coronary artery Z-score ultrasound, single-dose IVIG 2 g/kg, and high-dose Aspirin.',
    keywords: ['kawasaki', 'coronary aneurysm', 'ivig', 'aspirin', 'series 31', 'pediatric'],
  },
  {
    id: 'pediatric-pyloric-stenosis',
    to: '/pediatric-pyloric-stenosis',
    title: 'Infantile Hypertrophic Pyloric Stenosis',
    category: 'pediatric',
    icon: '🍼',
    badge: 'Series 30',
    urgency: 'urgent',
    summary: 'Non-bilious projectile vomiting, hypochloremic hypokalemic metabolic alkalosis, target/doughnut sign ultrasound, rehydration, and pyloromyotomy.',
    keywords: ['pyloric stenosis', 'projectile vomiting', 'metabolic alkalosis', 'pyloromyotomy', 'series 30', 'pediatric'],
  },
  {
    id: 'pediatric-meningitis',
    to: '/pediatric-meningitis',
    title: 'Pediatric Acute Bacterial Meningitis',
    category: 'pediatric',
    icon: '🧠',
    badge: 'Series 29',
    urgency: 'immediate',
    summary: 'LP CSF interpretation: pleocytosis, CSF:blood glucose ratio < 0.4, elevated protein, immediate empiric Ceftriaxone + Vancomycin + Dexamethasone.',
    keywords: ['meningitis', 'csf pleocytosis', 'ceftriaxone', 'vancomycin', 'series 29', 'pediatric'],
  },
  {
    id: 'pediatric-appendicitis',
    to: '/pediatric-appendicitis',
    title: 'Pediatric Appendicitis Scoring (PAS)',
    category: 'pediatric',
    icon: '🩹',
    badge: 'Series 28',
    urgency: 'urgent',
    summary: 'Pediatric Appendicitis Score (PAS / Samuel score), right lower quadrant targeted ultrasound, hydration, and emergency surgical consultation.',
    keywords: ['appendicitis', 'pas score', 'rlq pain', 'alvarado', 'series 28', 'pediatric'],
  },
  {
    id: 'pediatric-intussusception',
    to: '/pediatric-intussusception',
    title: 'Pediatric Intussusception Reduction',
    category: 'pediatric',
    icon: '🌀',
    badge: 'Series 27',
    urgency: 'immediate',
    summary: 'Paroxysmal colicky abdominal pain & red currant jelly stool, target sign ultrasound, pneumatic / hydrostatic enema reduction, and peritonitis check.',
    keywords: ['intussusception', 'target sign', 'air enema', 'currant jelly', 'series 27', 'pediatric'],
  },
  {
    id: 'pediatric-septic-arthritis',
    to: '/pediatric-septic-arthritis',
    title: 'Pediatric Septic Arthritis (Kocher Criteria)',
    category: 'pediatric',
    icon: '🦴',
    badge: 'Series 26',
    urgency: 'immediate',
    summary: 'Kocher 4-point criteria for septic hip: non-weight bearing, fever > 38.5°C, ESR > 40, WBC > 12k. Urgent bedside ultrasound and arthrocentesis.',
    keywords: ['septic arthritis', 'kocher', 'hip effusion', 'arthrocentesis', 'series 26', 'pediatric'],
  },
  {
    id: 'pediatric-foreign-body',
    to: '/pediatric-foreign-body',
    title: 'Pediatric Foreign Body Airway Obstruction',
    category: 'pediatric',
    icon: '🥜',
    badge: 'Series 25',
    urgency: 'immediate',
    summary: 'Infant (< 1 yr): 5 back slaps + 5 chest thrusts; Child (>= 1 yr): subdiaphragmatic Heimlich thrusts; Unconscious: CPR with airway visualization.',
    keywords: ['foreign body', 'choking', 'fbao', 'heimlich', 'airway obstruction', 'series 25', 'pediatric'],
  },
  {
    id: 'pediatric-croup',
    to: '/pediatric-croup',
    title: 'Pediatric Croup & Westley Score',
    category: 'pediatric',
    icon: '🌬️',
    badge: 'Series 24',
    urgency: 'urgent',
    summary: 'Westley croup score calculation: single dose oral Dexamethasone 0.15-0.6 mg/kg, and nebulized racemic/L-epinephrine for moderate-to-severe stridor.',
    keywords: ['croup', 'westley score', 'stridor', 'dexamethasone', 'epinephrine', 'series 24', 'pediatric'],
  },
  {
    id: 'pediatric-svt',
    to: '/pediatric-svt',
    title: 'Pediatric Supraventricular Tachycardia (SVT)',
    category: 'pediatric',
    icon: '⚡',
    badge: 'Series 23',
    urgency: 'immediate',
    summary: 'HR > 220 (infant) / > 180 (child): ice bag to face vagal maneuvers, rapid IV push Adenosine (0.1 -> 0.2 mg/kg), and synchronized cardioversion 0.5-1 J/kg.',
    keywords: ['svt', 'tachycardia', 'adenosine', 'cardioversion', 'vagal', 'series 23', 'pediatric'],
  },
  {
    id: 'pediatric-anaphylaxis',
    to: '/pediatric-anaphylaxis',
    title: 'Pediatric Anaphylaxis Resuscitation',
    category: 'pediatric',
    icon: '🚨',
    badge: 'Series 22',
    urgency: 'immediate',
    summary: 'Immediate IM Epinephrine 0.01 mg/kg (max 0.3 mg child, 0.5 mg adolescent) anterolateral thigh, aggressive isotonic bolus, H1/H2 blockers, and steroids.',
    keywords: ['anaphylaxis', 'epinephrine', 'shock', 'urticaria', 'stridor', 'series 22', 'pediatric'],
  },
  {
    id: 'pediatric-polytrauma',
    to: '/pediatric-polytrauma',
    title: 'Pediatric Polytrauma & PTS Scoring',
    category: 'pediatric',
    icon: '🚨',
    badge: 'Series 21',
    urgency: 'immediate',
    summary: 'Pediatric Trauma Score (PTS <= 8 triggers trauma center activation), ATLS ABCDE primary survey, pelvic binder, and massive transfusion protocol.',
    keywords: ['polytrauma', 'trauma', 'pts score', 'atls', 'series 21', 'pediatric'],
  },
  {
    id: 'pediatric-asthma',
    to: '/pediatric-asthma',
    title: 'Pediatric Acute Asthma Severity Protocol',
    category: 'pediatric',
    icon: '🫁',
    badge: 'Series 20',
    urgency: 'urgent',
    summary: 'PRAM / PIS asthma severity scoring, back-to-back Salbutamol + Ipratropium inhalations, oral Prednisolone, and IV Magnesium Sulfate for severe flares.',
    keywords: ['asthma', 'pram score', 'salbutamol', 'magnesium', 'series 20', 'pediatric'],
  },
  {
    id: 'pediatric-tbi',
    to: '/pediatric-tbi',
    title: 'Pediatric TBI & PECARN Neuroimaging',
    category: 'pediatric',
    icon: '🧠',
    badge: 'Series 19',
    urgency: 'immediate',
    summary: 'PECARN validated head injury algorithm (< 2 yrs vs >= 2 yrs) to rule out clinically important traumatic brain injury (ciTBI) without unnecessary CT.',
    keywords: ['tbi', 'head injury', 'pecarn', 'ct scan', 'gcs', 'series 19', 'pediatric'],
  },
  {
    id: 'pediatric-status-epilepticus',
    to: '/pediatric-status-epilepticus',
    title: 'Pediatric Status Epilepticus Resuscitation',
    category: 'pediatric',
    icon: '⚡',
    badge: 'Series 18',
    urgency: 'immediate',
    summary: 'Time-stamped convulsive status protocol: 0-5m Benzodiazepine, 5-10m second dose, 10-20m Levetiracetam/Fosphenytoin/Valproate, 20m+ RSI induction.',
    keywords: ['status epilepticus', 'convulsions', 'midazolam', 'levetiracetam', 'seizures', 'series 18', 'pediatric'],
  },
  {
    id: 'pediatric-pards',
    to: '/pediatric-pards',
    title: 'Pediatric ARDS (PALICC-2 PARDS)',
    category: 'pediatric',
    icon: '🫁',
    badge: 'Series 17',
    urgency: 'immediate',
    summary: 'PALICC-2 diagnostic criteria: Oxygenation Index (OI) & OSI calculation, lung-protective ventilation (VT 3-6 mL/kg), prone positioning, and neuromuscular block.',
    keywords: ['pards', 'palicc', 'ards', 'oxygenation index', 'lung protective', 'series 17', 'pediatric'],
  },
  {
    id: 'pediatric-septic-shock',
    to: '/pediatric-septic-shock',
    title: 'Pediatric Septic Shock & Vasoactives',
    category: 'pediatric',
    icon: '🧸',
    badge: 'Series 16',
    urgency: 'immediate',
    summary: 'ACCM pediatric septic shock bundle: 10-20 mL/kg balanced crystalloids within 30 min, early Epinephrine (cold shock) vs Norepinephrine (warm shock) within 60 min.',
    keywords: ['septic shock', 'vasoactive', 'epinephrine', 'norepinephrine', 'accm', 'series 16', 'pediatric'],
  },
  {
    id: 'pediatric-seizures',
    to: '/pediatric-seizures',
    title: 'Pediatric Febrile Seizures & Epilepsy Pathway',
    category: 'pediatric',
    icon: '⚡',
    badge: 'Series 15',
    urgency: 'urgent',
    summary: 'Simple vs complex febrile seizures classification, neurodiagnostic indications, antipyretic counseling, and rescue midazolam prescription.',
    keywords: ['febrile seizures', 'epilepsy', 'midazolam', 'convulsions', 'series 15', 'pediatric'],
  },
  {
    id: 'pediatric-dka',
    to: '/pediatric-dka',
    title: 'Pediatric Diabetic Ketoacidosis (DKA)',
    category: 'pediatric',
    icon: '🍼',
    badge: 'Series 14',
    urgency: 'immediate',
    summary: 'ISPAD 2022 guidelines: 10-20 mL/kg 0.9% saline over 1 hr, followed by regular insulin infusion 0.05-0.1 U/kg/hr after 1 hr, two-bag system, and neuro checks.',
    keywords: ['dka', 'diabetic ketoacidosis', 'ispad', 'insulin infusion', 'potassium', 'series 14', 'pediatric'],
  },
  {
    id: 'pediatric-allergy',
    to: '/pediatric-allergy',
    title: 'Pediatric Asthma & Allergy Management',
    category: 'pediatric',
    icon: '🫁',
    badge: 'Series 13',
    urgency: 'routine',
    summary: 'GINA stepwise asthma controller selection, spacer technique verification, allergic rhinitis stepwise therapy, and allergen immunotherapy.',
    keywords: ['asthma', 'allergy', 'gina', 'inhaler', 'rhinitis', 'series 13', 'pediatric'],
  },
  {
    id: 'pals-emergency',
    to: '/pals-emergency',
    title: 'PALS Emergency Resuscitation & Broselow Tape',
    category: 'pediatric',
    icon: '🚨',
    badge: 'Critical Care',
    urgency: 'immediate',
    summary: 'Color-coded Broselow length-based calibration: weight estimation, endotracheal tube sizes, defibrillation joules (2 -> 4 J/kg), and resuscitation drug doses.',
    keywords: ['pals', 'broselow', 'code blue', 'defibrillation', 'epinephrine', 'pediatric emergency', 'pediatric'],
  },

  // --- SPECIALTY & CRITICAL CARE ---
  {
    id: 'ams',
    to: '/ams',
    title: 'Antimicrobial Stewardship (AMS) & Antibiogram',
    category: 'specialty',
    icon: '🧫',
    badge: 'Stewardship',
    urgency: 'routine',
    summary: 'WHO AWaRe classification (Access, Watch, Reserve), 48-72h antibiotic timeout verification, restricted antibiotic pre-authorization, and local antibiogram.',
    keywords: ['ams', 'antimicrobial stewardship', 'antibiotics', 'aware', 'antibiogram', 'specialty'],
  },
  {
    id: 'pediatric-renal',
    to: '/pediatric-renal',
    title: 'Pediatric Renal & Peritoneal Dialysis',
    category: 'specialty',
    icon: '💧',
    badge: 'Specialty',
    urgency: 'urgent',
    summary: 'Schwartz bedside GFR calculation, KDIGO acute kidney injury staging, and acute peritoneal dialysis fill/dwell/drain cycle flowsheet logging.',
    keywords: ['renal', 'peritoneal dialysis', 'schwartz gfr', 'kdigo', 'dialysis', 'specialty'],
  },
  {
    id: 'blood-bank',
    to: '/blood-bank',
    title: 'Blood Bank & Massive Transfusion Protocol (MTP)',
    category: 'specialty',
    icon: '🩸',
    badge: 'Blood Bank',
    urgency: 'immediate',
    summary: 'Inventory surveillance, emergency uncrossmatched O-negative blood release, balanced 1:1:1 PRBC / FFP / Platelets MTP pack activations, and audits.',
    keywords: ['blood bank', 'mtp', 'massive transfusion', 'o negative', 'prbc', 'ffp', 'specialty'],
  },
  {
    id: 'ot-schedule',
    to: '/ot-schedule',
    title: 'Operating Theatre (OT) Surgical Board',
    category: 'specialty',
    icon: '🔪',
    badge: 'Surgical',
    urgency: 'urgent',
    summary: 'Elective and emergency OT theater scheduling, WHO Surgical Safety Checklist sign-in/time-out/sign-out, and PAC clearances.',
    keywords: ['ot', 'surgery', 'operating theatre', 'who surgical checklist', 'pac', 'specialty'],
  },
  {
    id: 'teleconsultations',
    to: '/teleconsultations',
    title: 'Teleconsultations & E-Prescription Gateway',
    category: 'specialty',
    icon: '📹',
    badge: 'Digital Care',
    urgency: 'routine',
    summary: 'WebRTC encrypted video appointments, patient intake queue, digital prescription signing with verification QR codes.',
    keywords: ['teleconsult', 'telemedicine', 'video call', 'eprescription', 'digital care', 'specialty'],
  },
];

export function ProtocolsHubPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'obstetric' | 'neonatal' | 'pediatric' | 'specialty'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CLINICAL_PROTOCOLS.filter((p) => {
      const matchCat = category === 'all' || p.category === category;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  const counts = useMemo(() => {
    return {
      all: CLINICAL_PROTOCOLS.length,
      obstetric: CLINICAL_PROTOCOLS.filter((p) => p.category === 'obstetric').length,
      neonatal: CLINICAL_PROTOCOLS.filter((p) => p.category === 'neonatal').length,
      pediatric: CLINICAL_PROTOCOLS.filter((p) => p.category === 'pediatric').length,
      specialty: CLINICAL_PROTOCOLS.filter((p) => p.category === 'specialty').length,
    };
  }, []);

  return (
    <div className="page" style={{ maxWidth: '1200px' }}>
      <div className="page-head" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.75rem' }}>
            <span>🚨</span> Clinical Protocols & Emergency Hub
          </h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Evidence-based clinical guidelines, dosing nomograms, and emergency resuscitation algorithms.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: '1rem' }}>
            {CLINICAL_PROTOCOLS.length} Active Protocols
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'grid',
          gap: '0.85rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            type="search"
            placeholder="🔍 Quick search protocols, drugs, scores (e.g. DKA, PPH, Eclampsia, Cooling, HUS, Asthma, Ammonia)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              paddingLeft: '1rem',
              fontSize: '1rem',
              borderRadius: '6px',
            }}
            autoFocus
          />
        </div>

        {/* Category Pill Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn small ${category === 'all' ? 'primary' : ''}`}
            onClick={() => setCategory('all')}
          >
            All Protocols ({counts.all})
          </button>
          <button
            type="button"
            className={`btn small ${category === 'obstetric' ? 'primary' : ''}`}
            onClick={() => setCategory('obstetric')}
          >
            🤰 Obstetric & Maternal ({counts.obstetric})
          </button>
          <button
            type="button"
            className={`btn small ${category === 'neonatal' ? 'primary' : ''}`}
            onClick={() => setCategory('neonatal')}
          >
            👶 Neonatology & NICU ({counts.neonatal})
          </button>
          <button
            type="button"
            className={`btn small ${category === 'pediatric' ? 'primary' : ''}`}
            onClick={() => setCategory('pediatric')}
          >
            🧸 Pediatrics & PICU ({counts.pediatric})
          </button>
          <button
            type="button"
            className={`btn small ${category === 'specialty' ? 'primary' : ''}`}
            onClick={() => setCategory('specialty')}
          >
            🧪 Specialty & Critical Care ({counts.specialty})
          </button>
        </div>
      </div>

      {/* Protocol Cards Grid */}
      {filtered.length === 0 ? (
        <div className="card center muted" style={{ padding: '3rem 1rem' }}>
          <h3>No protocols match "{query}"</h3>
          <p>Try searching for a condition (e.g. "asthma"), medication ("magnesium"), or scoring system ("pewarn").</p>
          <button className="btn small" onClick={() => { setQuery(''); setCategory('all'); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '1rem',
          }}
        >
          {filtered.map((p) => {
            const urgencyBg =
              p.urgency === 'immediate'
                ? '#fee2e2'
                : p.urgency === 'urgent'
                ? '#fef3c7'
                : '#e0f2fe';
            const urgencyColor =
              p.urgency === 'immediate'
                ? '#991b1b'
                : p.urgency === 'urgent'
                ? '#92400e'
                : '#075985';
            const urgencyText =
              p.urgency === 'immediate'
                ? '🔴 Immediate Resus'
                : p.urgency === 'urgent'
                ? '🟠 Urgent Critical'
                : '🔵 Protocol';

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{p.icon}</span>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.3 }}>{p.title}</h3>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: urgencyBg,
                      color: urgencyColor,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {urgencyText}
                  </span>
                </div>

                {p.badge && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '3px',
                        background: 'var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      {p.badge}
                    </span>
                  </div>
                )}

                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted, #555)', margin: '0 0 1rem', flex: 1, lineHeight: 1.45 }}>
                  {p.summary}
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <Link
                    to={p.to}
                    className="btn small primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      textDecoration: 'none',
                    }}
                  >
                    Launch Protocol &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
