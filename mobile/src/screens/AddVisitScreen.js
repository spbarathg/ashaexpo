import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { colors } from '../styles/colors';
import { spacing } from '../styles/spacing';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import RiskBadge from '../components/RiskBadge';
import AudioRecorder from '../components/AudioRecorder';
import { VISIT_TYPE_OPTIONS, VISIT_TYPES } from '../constants/visitTypes';
import { SYNC_PRIORITY } from '../constants/appConfig';
import { getPatientById } from '../database/patientRepository';
import { insertVisit } from '../database/visitRepository';
import { insertAlert } from '../database/alertRepository';
import { enqueue } from '../database/syncQueueRepository';
import { generateId } from '../utils/idGenerator';
import { nowISO } from '../utils/dateUtils';
import { parseNote, getExtractionSummary } from '../utils/keywordParser';
import { evaluateRisk } from '../utils/riskEngine';
import { isOnline } from '../services/connectivityService';
import { processQueue } from '../services/syncManager';

function SwitchRow({ label, value, onToggle }) {
  return (
    <View style={srStyles.row}>
      <Text style={srStyles.label}>{label}</Text>
      <Switch value={value} onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={value ? colors.primary : '#f4f3f4'} />
    </View>
  );
}
const srStyles = StyleSheet.create({
  row: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:12, marginBottom:8, borderBottomWidth:1, borderBottomColor:colors.divider },
  label: { fontSize:15, fontWeight:'500', color:colors.text, flex:1 },
});

export default function AddVisitScreen({ route, navigation }) {
  const patientId = route.params?.patientId;
  const [patient, setPatient] = useState(null);
  const [visitType, setVisitType] = useState('');
  const [saving, setSaving] = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);
  const [extractedSummary, setExtractedSummary] = useState([]);
  const [riskResult, setRiskResult] = useState(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [fields, setFields] = useState({
    anc_number:'', trimester:'', bp_systolic:'', bp_diastolic:'',
    weight_kg:'', gestational_weeks:'', bleeding:false, seizure:false,
    postnatal_day:'', temperature_c:'', breathlessness:false, muac_cm:'',
    vaccination_due:false, vaccination_given:false, tb_cough_weeks:'',
    tb_followup_missed:false, raw_note:'',
  });

  useEffect(() => { if(patientId) getPatientById(patientId).then(setPatient); }, [patientId]);
  const updateField = (k,v) => setFields(p => ({...p,[k]:v}));

  const handleParseNote = () => {
    const ext = parseNote(fields.raw_note);
    const summary = getExtractionSummary(ext);
    setFields(p => ({...p,
      bp_systolic: ext.bp_systolic ? String(ext.bp_systolic) : p.bp_systolic,
      bp_diastolic: ext.bp_diastolic ? String(ext.bp_diastolic) : p.bp_diastolic,
      temperature_c: ext.temperature_c ? String(ext.temperature_c) : p.temperature_c,
      bleeding: ext.bleeding ? true : p.bleeding,
      seizure: ext.seizure ? true : p.seizure,
      breathlessness: ext.breathlessness ? true : p.breathlessness,
      tb_cough_weeks: ext.tb_cough_weeks ? String(ext.tb_cough_weeks) : p.tb_cough_weeks,
      tb_followup_missed: ext.tb_followup_missed ? true : p.tb_followup_missed,
      vaccination_due: ext.vaccination_due ? true : p.vaccination_due,
      vaccination_given: ext.vaccination_given ? true : p.vaccination_given,
      muac_cm: ext.muac_cm ? String(ext.muac_cm) : p.muac_cm,
    }));
    setExtractedSummary(summary);
    setShowExtracted(summary.length > 0);
  };

  const handleAIResult = (aiJson) => {
    if (!aiJson || typeof aiJson !== 'object') return;

    // Set visitType FIRST so conditional fields render before merge
    if (aiJson.visit_type) setVisitType(aiJson.visit_type);

    // Merge into fields using same truthy-only overwrite pattern as handleParseNote
    setFields(p => ({
      ...p,
      raw_note: aiJson.raw_note ? String(aiJson.raw_note) : p.raw_note,
      bp_systolic: aiJson.bp_systolic ? String(aiJson.bp_systolic) : p.bp_systolic,
      bp_diastolic: aiJson.bp_diastolic ? String(aiJson.bp_diastolic) : p.bp_diastolic,
      temperature_c: aiJson.temperature_c ? String(aiJson.temperature_c) : p.temperature_c,
      weight_kg: aiJson.weight_kg ? String(aiJson.weight_kg) : p.weight_kg,
      anc_number: aiJson.anc_number ? String(aiJson.anc_number) : p.anc_number,
      trimester: aiJson.trimester ? String(aiJson.trimester) : p.trimester,
      gestational_weeks: aiJson.gestational_weeks ? String(aiJson.gestational_weeks) : p.gestational_weeks,
      postnatal_day: aiJson.postnatal_day ? String(aiJson.postnatal_day) : p.postnatal_day,
      muac_cm: aiJson.muac_cm ? String(aiJson.muac_cm) : p.muac_cm,
      tb_cough_weeks: aiJson.tb_cough_weeks ? String(aiJson.tb_cough_weeks) : p.tb_cough_weeks,
      bleeding: aiJson.bleeding === true ? true : p.bleeding,
      seizure: aiJson.seizure === true ? true : p.seizure,
      breathlessness: aiJson.breathlessness === true ? true : p.breathlessness,
      vaccination_due: aiJson.vaccination_due === true ? true : p.vaccination_due,
      vaccination_given: aiJson.vaccination_given === true ? true : p.vaccination_given,
      tb_followup_missed: aiJson.tb_followup_missed === true ? true : p.tb_followup_missed,
    }));

    // Build summary lines for the existing extraction UI
    const lines = [];
    if (aiJson.visit_type) lines.push(`Visit Type: ${aiJson.visit_type}`);
    if (aiJson.bp_systolic && aiJson.bp_diastolic) lines.push(`BP: ${aiJson.bp_systolic}/${aiJson.bp_diastolic} mmHg`);
    if (aiJson.temperature_c) lines.push(`Temperature: ${aiJson.temperature_c}°C`);
    if (aiJson.weight_kg) lines.push(`Weight: ${aiJson.weight_kg} kg`);
    if (aiJson.gestational_weeks) lines.push(`Gestational Weeks: ${aiJson.gestational_weeks}`);
    if (aiJson.trimester) lines.push(`Trimester: ${aiJson.trimester}`);
    if (aiJson.anc_number) lines.push(`ANC Number: ${aiJson.anc_number}`);
    if (aiJson.postnatal_day) lines.push(`Postnatal Day: ${aiJson.postnatal_day}`);
    if (aiJson.muac_cm) lines.push(`MUAC: ${aiJson.muac_cm} cm`);
    if (aiJson.tb_cough_weeks) lines.push(`Cough: ${aiJson.tb_cough_weeks} weeks`);
    if (aiJson.bleeding === true) lines.push('Bleeding (खून)');
    if (aiJson.seizure === true) lines.push('Seizure (दौरा)');
    if (aiJson.breathlessness === true) lines.push('Breathlessness (साँस)');
    if (aiJson.vaccination_due === true) lines.push('Vaccination Due (टीका बाकी)');
    if (aiJson.vaccination_given === true) lines.push('Vaccination Given (टीका दिया)');
    if (aiJson.tb_followup_missed === true) lines.push('TB Follow-up Missed (टीबी फॉलो-अप छूटा)');
    setExtractedSummary(lines);
    setShowExtracted(lines.length > 0);

    // Enrich: run local keywordParser on AI transcript to catch fields Gemini may have missed
    if (aiJson.raw_note) {
      const localExt = parseNote(aiJson.raw_note);
      setFields(p => ({
        ...p,
        bp_systolic: p.bp_systolic || (localExt.bp_systolic ? String(localExt.bp_systolic) : ''),
        bp_diastolic: p.bp_diastolic || (localExt.bp_diastolic ? String(localExt.bp_diastolic) : ''),
        temperature_c: p.temperature_c || (localExt.temperature_c ? String(localExt.temperature_c) : ''),
        weight_kg: p.weight_kg || (localExt.weight_kg ? String(localExt.weight_kg) : ''),
        gestational_weeks: p.gestational_weeks || (localExt.gestational_weeks ? String(localExt.gestational_weeks) : ''),
        trimester: p.trimester || (localExt.trimester ? String(localExt.trimester) : ''),
        muac_cm: p.muac_cm || (localExt.muac_cm ? String(localExt.muac_cm) : ''),
        tb_cough_weeks: p.tb_cough_weeks || (localExt.tb_cough_weeks ? String(localExt.tb_cough_weeks) : ''),
        bleeding: p.bleeding || (localExt.bleeding ? true : false),
        seizure: p.seizure || (localExt.seizure ? true : false),
        breathlessness: p.breathlessness || (localExt.breathlessness ? true : false),
        vaccination_due: p.vaccination_due || (localExt.vaccination_due ? true : false),
        vaccination_given: p.vaccination_given || (localExt.vaccination_given ? true : false),
        tb_followup_missed: p.tb_followup_missed || (localExt.tb_followup_missed ? true : false),
      }));
      // Set visit type from local hint if AI didn't provide one
      if (!aiJson.visit_type && localExt.visit_type_hint) {
        setVisitType(localExt.visit_type_hint);
      }
    }
  };

  const handleProcessingChange = (processing) => setIsProcessingAI(processing);

  const handleSave = async () => {
    if(!visitType){ Alert.alert('Required','Please select visit type'); return; }
    if(!patient){ Alert.alert('Error','Patient not found'); return; }

    // Auto-parse: if worker typed a raw_note but never pressed Parse, extract now
    if (fields.raw_note && !showExtracted) {
      const fallbackExt = parseNote(fields.raw_note);
      const fallbackSummary = getExtractionSummary(fallbackExt);
      if (fallbackSummary.length > 0) {
        setFields(p => ({
          ...p,
          bp_systolic: p.bp_systolic || (fallbackExt.bp_systolic ? String(fallbackExt.bp_systolic) : ''),
          bp_diastolic: p.bp_diastolic || (fallbackExt.bp_diastolic ? String(fallbackExt.bp_diastolic) : ''),
          temperature_c: p.temperature_c || (fallbackExt.temperature_c ? String(fallbackExt.temperature_c) : ''),
          weight_kg: p.weight_kg || (fallbackExt.weight_kg ? String(fallbackExt.weight_kg) : ''),
          gestational_weeks: p.gestational_weeks || (fallbackExt.gestational_weeks ? String(fallbackExt.gestational_weeks) : ''),
          trimester: p.trimester || (fallbackExt.trimester ? String(fallbackExt.trimester) : ''),
          muac_cm: p.muac_cm || (fallbackExt.muac_cm ? String(fallbackExt.muac_cm) : ''),
          tb_cough_weeks: p.tb_cough_weeks || (fallbackExt.tb_cough_weeks ? String(fallbackExt.tb_cough_weeks) : ''),
          bleeding: p.bleeding || (fallbackExt.bleeding ? true : false),
          seizure: p.seizure || (fallbackExt.seizure ? true : false),
          breathlessness: p.breathlessness || (fallbackExt.breathlessness ? true : false),
          vaccination_due: p.vaccination_due || (fallbackExt.vaccination_due ? true : false),
          vaccination_given: p.vaccination_given || (fallbackExt.vaccination_given ? true : false),
          tb_followup_missed: p.tb_followup_missed || (fallbackExt.tb_followup_missed ? true : false),
        }));
        if (!visitType && fallbackExt.visit_type_hint) setVisitType(fallbackExt.visit_type_hint);
      }
    }

    setSaving(true);
    try {
      const visitId = generateId();
      const createdAt = nowISO();
      const f = fields;
      const visitData = {
        id:visitId, patient_id:patientId, visit_type:visitType,
        anc_number:f.anc_number?parseInt(f.anc_number):null,
        trimester:f.trimester?parseInt(f.trimester):null,
        bp_systolic:f.bp_systolic?parseInt(f.bp_systolic):null,
        bp_diastolic:f.bp_diastolic?parseInt(f.bp_diastolic):null,
        weight_kg:f.weight_kg?parseFloat(f.weight_kg):null,
        gestational_weeks:f.gestational_weeks?parseInt(f.gestational_weeks):null,
        bleeding:f.bleeding?1:0, seizure:f.seizure?1:0,
        postnatal_day:f.postnatal_day?parseInt(f.postnatal_day):null,
        temperature_c:f.temperature_c?parseFloat(f.temperature_c):null,
        breathlessness:f.breathlessness?1:0,
        muac_cm:f.muac_cm?parseFloat(f.muac_cm):null,
        vaccination_due:f.vaccination_due?1:0, vaccination_given:f.vaccination_given?1:0,
        tb_cough_weeks:f.tb_cough_weeks?parseInt(f.tb_cough_weeks):null,
        tb_followup_missed:f.tb_followup_missed?1:0,
        raw_note:f.raw_note, parsed_fields:JSON.stringify(parseNote(f.raw_note)),
        created_at:createdAt,
      };
      const risk = evaluateRisk(visitData, patient);
      visitData.risk_level = risk.riskLevel;
      visitData.risk_flags = JSON.stringify(risk.riskFlags);
      await insertVisit(visitData);

      if(risk.riskLevel==='medium'||risk.riskLevel==='high'){
        const alertId = generateId();
        const alertData = { id:alertId, visit_id:visitId, patient_id:patientId,
          patient_name:patient.name, village:patient.village,
          risk_flags:risk.riskFlags, risk_level:risk.riskLevel, created_at:createdAt };
        await insertAlert(alertData);
        await enqueue('alert',alertId,SYNC_PRIORITY.ALERT,{
          ...alertData, risk_flags:risk.riskFlags, status:'sent', asha_phone:patient.phone||''});
      }
      await enqueue('visit',visitId,SYNC_PRIORITY.VISIT,{
        ...visitData, patient_name:patient.name, village:patient.village,
        asha_id:patient.asha_id, risk_flags:risk.riskFlags});

      setRiskResult(risk);
      const wasOnline = isOnline();
      if(wasOnline) processQueue();

      const syncMsg = wasOnline ? '☁️ Synced to server' : '📴 Saved offline — will sync automatically';
      Alert.alert('✅ Visit Saved',
        risk.riskLevel!=='none'
          ? `Risk: ${risk.riskLevel.toUpperCase()}\nFlags: ${risk.riskFlags.join(', ')}\n\n${syncMsg}`
          : `Visit recorded successfully.\n\n${syncMsg}`,
        [{text:'OK',onPress:()=>navigation.goBack()}]);
    } catch(err){ console.error(err); Alert.alert('Error','Failed to save visit.'); }
    finally { setSaving(false); }
  };

  const showANC=visitType===VISIT_TYPES.ANC, showPostnatal=visitType===VISIT_TYPES.POSTNATAL;
  const showChild=visitType===VISIT_TYPES.CHILD, showTB=visitType===VISIT_TYPES.TB_FOLLOWUP;
  const showVax=visitType===VISIT_TYPES.VACCINATION, showGeneral=visitType===VISIT_TYPES.GENERAL;
  const showBP=showANC||showPostnatal||showGeneral;

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Add Visit / विजिट जोड़ें</Text>
      {patient&&<View style={s.banner}><Text style={s.bannerName}>👤 {patient.name}</Text>
        <Text style={s.bannerInfo}>{patient.age} yrs • {patient.village}</Text></View>}
      {!patient&&<TouchableOpacity style={s.selectBtn} onPress={()=>navigation.navigate('PatientList')}>
        <Text style={s.selectText}>👤 Select Patient First</Text></TouchableOpacity>}
      <View style={s.form}>
        <FormSelect label="Visit Type *" options={VISIT_TYPE_OPTIONS} value={visitType} onChange={setVisitType}/>
        {showANC&&<><FormInput label="ANC Number" value={fields.anc_number} onChangeText={v=>updateField('anc_number',v)} keyboardType="numeric"/>
          <FormInput label="Trimester" value={fields.trimester} onChangeText={v=>updateField('trimester',v)} keyboardType="numeric"/>
          <FormInput label="Gestational Weeks" value={fields.gestational_weeks} onChangeText={v=>updateField('gestational_weeks',v)} keyboardType="numeric"/>
          <FormInput label="Weight (kg)" value={fields.weight_kg} onChangeText={v=>updateField('weight_kg',v)} keyboardType="decimal-pad"/></>}
        {showBP&&<View style={s.bpRow}><View style={{flex:1}}><FormInput label="BP Systolic" value={fields.bp_systolic} onChangeText={v=>updateField('bp_systolic',v)} keyboardType="numeric"/></View>
          <Text style={s.slash}>/</Text><View style={{flex:1}}><FormInput label="BP Diastolic" value={fields.bp_diastolic} onChangeText={v=>updateField('bp_diastolic',v)} keyboardType="numeric"/></View></View>}
        {showPostnatal&&<FormInput label="Postnatal Day" value={fields.postnatal_day} onChangeText={v=>updateField('postnatal_day',v)} keyboardType="numeric"/>}
        {(showANC||showPostnatal)&&<><SwitchRow label="Bleeding / खून" value={fields.bleeding} onToggle={v=>updateField('bleeding',v)}/>
          <SwitchRow label="Seizure / दौरा" value={fields.seizure} onToggle={v=>updateField('seizure',v)}/></>}
        {showChild&&<><FormInput label="Temperature (°C)" value={fields.temperature_c} onChangeText={v=>updateField('temperature_c',v)} keyboardType="decimal-pad"/>
          <SwitchRow label="Breathlessness / साँस" value={fields.breathlessness} onToggle={v=>updateField('breathlessness',v)}/>
          <FormInput label="MUAC (cm)" value={fields.muac_cm} onChangeText={v=>updateField('muac_cm',v)} keyboardType="decimal-pad"/>
          <SwitchRow label="Vaccination Due / टीका बाकी" value={fields.vaccination_due} onToggle={v=>updateField('vaccination_due',v)}/>
          <SwitchRow label="Vaccination Given / टीका दिया" value={fields.vaccination_given} onToggle={v=>updateField('vaccination_given',v)}/></>}
        {showTB&&<><FormInput label="Cough (weeks) / खाँसी" value={fields.tb_cough_weeks} onChangeText={v=>updateField('tb_cough_weeks',v)} keyboardType="numeric"/>
          <SwitchRow label="Follow-up Missed" value={fields.tb_followup_missed} onToggle={v=>updateField('tb_followup_missed',v)}/></>}
        {showVax&&<><SwitchRow label="Vaccination Due" value={fields.vaccination_due} onToggle={v=>updateField('vaccination_due',v)}/>
          <SwitchRow label="Vaccination Given" value={fields.vaccination_given} onToggle={v=>updateField('vaccination_given',v)}/></>}
        {showGeneral&&<FormInput label="Temperature (°C)" value={fields.temperature_c} onChangeText={v=>updateField('temperature_c',v)} keyboardType="decimal-pad"/>}
        {visitType?<><FormInput label="📝 Hindi/Hinglish Note" value={fields.raw_note} onChangeText={v=>updateField('raw_note',v)} multiline placeholder="e.g. BP high hai, khoon bhi aa raha hai"/>
          <AudioRecorder onResult={handleAIResult} onProcessingChange={handleProcessingChange}/>
          <TouchableOpacity style={s.parseBtn} onPress={handleParseNote}><Text style={s.parseTxt}>🔍 Parse Note / नोट पार्स करें</Text></TouchableOpacity>
          {showExtracted&&extractedSummary.length>0&&<View style={s.extBox}><Text style={s.extTitle}>हमने ये जानकारी निकाली:</Text>
            {extractedSummary.map((l,i)=><Text key={i} style={s.extLine}>• {l}</Text>)}
            <Text style={s.editHint}>✏️ You can edit fields above before saving</Text></View>}
          {riskResult&&<View style={s.riskBox}><RiskBadge riskLevel={riskResult.riskLevel}/>
            {riskResult.riskFlags.map((f,i)=><Text key={i} style={s.riskFlag}>⚠️ {f.replace(/_/g,' ')}</Text>)}</View>}
          <TouchableOpacity style={[s.saveBtn,(saving||isProcessingAI)&&{opacity:0.6}]} onPress={handleSave} disabled={saving||isProcessingAI}>
            <Text style={s.saveTxt}>{isProcessingAI?'🧠 AI Processing...':saving?'Saving...':'💾 Save Visit / विजिट सेव करें'}</Text></TouchableOpacity></>:null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:colors.background},
  title:{fontSize:24,fontWeight:'700',color:colors.text,margin:spacing.md},
  banner:{backgroundColor:colors.primary+'10',marginHorizontal:spacing.md,padding:spacing.md,borderRadius:10,borderLeftWidth:4,borderLeftColor:colors.primary,marginBottom:spacing.md},
  bannerName:{fontSize:17,fontWeight:'600',color:colors.text},
  bannerInfo:{fontSize:14,color:colors.textSecondary,marginTop:2},
  selectBtn:{backgroundColor:colors.warning+'15',margin:spacing.md,padding:spacing.md,borderRadius:10,borderWidth:1,borderColor:colors.warning},
  selectText:{fontSize:15,fontWeight:'600',color:colors.warning,textAlign:'center'},
  form:{paddingHorizontal:spacing.md,paddingBottom:spacing.xxl},
  bpRow:{flexDirection:'row',alignItems:'center'},
  slash:{fontSize:24,fontWeight:'700',color:colors.textSecondary,marginHorizontal:8,marginTop:12},
  parseBtn:{backgroundColor:colors.info,padding:14,borderRadius:10,alignItems:'center',marginBottom:spacing.md},
  parseTxt:{color:colors.textLight,fontSize:15,fontWeight:'600'},
  extBox:{backgroundColor:'#E8F5E9',padding:spacing.md,borderRadius:10,marginBottom:spacing.md,borderLeftWidth:4,borderLeftColor:colors.success},
  extTitle:{fontSize:16,fontWeight:'700',color:colors.primary,marginBottom:8},
  extLine:{fontSize:14,color:colors.text,marginBottom:3},
  editHint:{fontSize:12,color:colors.textSecondary,marginTop:8,fontStyle:'italic'},
  riskBox:{backgroundColor:colors.surface,padding:spacing.md,borderRadius:10,marginBottom:spacing.md,borderWidth:1,borderColor:colors.border},
  riskFlag:{fontSize:14,color:colors.riskHigh,marginTop:4,fontWeight:'500'},
  saveBtn:{backgroundColor:colors.primary,padding:spacing.md,borderRadius:12,alignItems:'center',marginTop:8},
  saveTxt:{color:colors.textLight,fontSize:17,fontWeight:'600'},
});
