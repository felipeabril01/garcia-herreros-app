import { db } from './db';

const SENTINEL='excel-import-20261013-2016-2017-2008-2011-complete';
const DATA='H4sIALJdzmoC/6WXSW4cyRmFr5LgugOIeVhqoCipJVkmBQOGoEWMZDayMruzqmiLq/YZfAItteCi0bve1k18Er/IrIloFgHDAFETK6Jevv/F9//5+fMZ5ykXwSjJzAQibaHEmaiJlMWkJF2SMZ/9cHa+8P06d82zLv/k+zQOeLXIsb32zQs/jnnz24BvccoMoYwIOr/R//n13/UzvPv0Bg+MUa2F0Uzjzcs2Xx+2wQeCc6EoVVScffnh81mKxQjLMgmOe+iRgXgeOPEpZkmjconWbZ51vm+ufL9qPbZ74ePaN8/9etUuV34vSRDqTkiijgnthBBV0jC2vW9ebu79XRXEuHTOWmonQUoX57wyhGnPYZVQxIogCL5knQyQY6pV71q/OAh6Pvjkm4vN74t8t5MDtyk7KYdSRrmtDr7Off+1eTfcYYsqhzLFjTacT3KMzDYXrkjKAZXLoRBXfCCRRVW/pGnk9Zr8bZua936Vh+Z8GX03HF1hVVDdmQpyQo7i8Mc+5o7kQhom2SSnKGm9SZyIQguRySYEiTFCfXKeahdDUVj1Zul9bC58GFvE6XWbfAeXPuYxDYthpwgGsRP1Uo457uqFXQ7LhR+/Hq0VlApDNTRNilC7nClnJMqIeiUmSdA0ERusVSF6HWyt16ebYeGXR8l+P/SxFu157lbj5lu/T5GDsJM+8Vo2Wv//wi/a7sFyCLNKC6bcJMw6i1IKR0wqiUivIMzjVaZWey0C96la9WwcuqNkb76NKfdQ+re261DOffkk4eq0LKep4TXcV/Xq/NFq5ElbSo2jkyqaXSxeFGJUZkQaGokFFIgLVkXpuOCqhvbtcIMD9wx7bb4vm8sBz/fX63zXXK1jHn9Zt/Opg1nIFZ9jTu0sjB2EWUkVTnrN3UWHYPnD+uYid7d5jhhT1lBn58S7SDVzJhGTDQhFGSc2ukiiyDoGzoIr1f+3N8O4qBr3FX3r20VuUm5QFsRmrxDxZPyUQjABVqr6/1eb7137z3mbSZZAghjncgaVMMpJZYnXBQcR+SY+BE2McwHPxZUUsOp9ez0RdIwIxTVenS9/9uBm17y48XHze79XhfSLP6n6+PFTlcWV1qaejfd+bJdYvEfLRCvjNMJQVWUu4Q1TgKaORIpiYZY0JERA1SaTtcv7cn70lQzNxdDfbb51KCZ2X23u+x2zcIwRtCetEppWSNSd1v6BLKCbc2bmGsYQpBK5niYokvichACcBm11UbFKm1KWl+slVMxNB1G7BbgO+mZVtGZ/+tXHrNK60qBa9WEYb9vlg9UoLTNGgu0zSwvaTo6SaPC19j6LE2kM4SCxpNbm6O2crLbPYzOd8OH/C7+23P1P4WcqqUCrOufwANKjG1WaBfypkHUOs3GbP0CzfjX0LRzzHdKGp9t23Iqbus+OZI8VkwnnhJMV1rfz4m6LMSYFQ6/jc4POgatUaECkeAZfkyBBeEqisR7CKWhSf/H5mCfT3qGbtf2xaX8ZV+2hlJxM4DoRMOUc/vDm7z61q5v9WgwNRhlJ+YxWyZzIEXnlWlK4pDUJjFPCuaKFmVyUMweXrvyi5uvKB39901z6xbDc5R1sofJROf266ypNu1ufhnG7eKYCYGvRL+d+SH1BximGIaqIVKicV7mQLGzJeMGlrzu+6X2XQKhhufmOYWH8CYTyFQ97X8wO74/4UnudVqpe0nk/tr+s87zHZAwD+dG852ZoWVF1usKRA6mkA92DM5QEZSv2o0jT5b5d12kqB79ctbX2f123/SoDoR/y9Tj0e1EKBj8RIM2N1fPJa9eLaTFosi0XpgJq5wiV7ISpPafwgmSHjAipgo7NeWEZj2HaZhfqND4U9SZg9vR7ROHInUYUGIQrr7u99v1X37y59mM/TQ2cCukU2055PLHishHExWoUt2iDNlJitcDyzHik9Zxd5GG8zsdWIT6b+3FiAVr1gZxI0mkSoD8rJmSFy49+Gq9mcB5tUk8dUmvV3G2ssLIIif4XLcZiqxQJsihSQC4RJDLI02GqeZW79mfIhMB4U7me+7zMy2MQ2KeoDnC7w+xwWI10gYwMvs38VNIELguhWcK0FC2B4YKIxCVLmLMwq+7SNQ+kl/lr82Hzx+a3A8yrUU+KQYczM4X7un4rQ9W6zGcu6MxjLjhkVqMTRwxWThm8lRZYyNHxUq9m86+p/+6G0Fd57OFPgj1HczGt0wFVpwsnnBZ6f2ZwF9QNy6O9piZTQ+cct9vWR2nSDpbHAF5a3G8FhsTb4rTEjJw4q9v9mG/bozsaTKNLsGZo3rV30ffDcdqfYLiz6B/8qHRth+HxaBPc80EbyjOLyxMsVCaVtESykjEuYHamtFihk7W21P3P0z/aB4BAK/TxBvdxowd9jmBOT8NcT211vnkLSHy7zBjM5h0A9uEuzgJRcqulngWitEFLrjHPKAzNwTsSUgxoGoz7UjA9TAJf+r7W9GrV3maoG/rVmMc63m9niL1CCwefOJWYf02txsuMW4zLIW7uZ03oI8IYOudNZjgWCrp9qDMWZRWqAve/uEsMCmAL0R7wtZX259HK7u6/TuUe6a2db6hS1u12ftGguUFAv3z5L/boWFLHDwAA';

type ImportRow=[string,string,string,string,string|null,string|null,string,string];

async function loadRows():Promise<ImportRow[]>{
  const bytes=Uint8Array.from(atob(DATA),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as ImportRow[];
}

export async function ensureReviewedAthleteImport20261013(){
  const database=db();
  const done:any=await database.prepare('SELECT id FROM audit WHERE id=?').bind(SENTINEL).first();
  if(done)return;
  const rows=await loadRows();
  const statements:any[]=[];
  let n=0;
  for(const [id,name,dob,category,docType,docNumber,guardian,phone] of rows){
    n++;
    const where=docNumber?'(doc_number=? OR (name=? AND dob=?))':'(name=? AND dob=?)';
    if(docNumber){
      statements.push(database.prepare("UPDATE athletes SET name=?,dob=?,category=?,doc_type=?,doc_number=?,guardian=?,relationship=CASE WHEN trim(COALESCE(relationship,''))='' THEN 'Acudiente' ELSE relationship END,phone=?,modality='Mensual',consent=1,consent_date='2026-10-01',status='active',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),version=version+1 WHERE "+where).bind(name,dob,category,docType,docNumber,guardian,phone,docNumber,name,dob));
      statements.push(database.prepare("INSERT INTO athletes (id,name,dob,category,doc_type,doc_number,address,guardian,relationship,phone,email,emergency_name,emergency_relation,emergency_phone,health_notes,modality,consent,consent_date,status,created_by,created_at,updated_at,version) SELECT ?,?,?,?,?,?,'',?,'Acudiente',?,NULL,'','','','','Mensual',1,'2026-10-01','active','felipe',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),1 WHERE NOT EXISTS (SELECT 1 FROM athletes WHERE "+where+")").bind(id,name,dob,category,docType,docNumber,guardian,phone,docNumber,name,dob));
      statements.push(database.prepare("INSERT OR IGNORE INTO audit (id,actor,action,entity_id,created_at) SELECT ?, 'felipe','athlete_imported_excel',id,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM athletes WHERE "+where+" LIMIT 1").bind('excel-import-20261013-'+String(n).padStart(3,'0'),docNumber,name,dob));
    }else{
      statements.push(database.prepare("UPDATE athletes SET name=?,dob=?,category=?,doc_type=?,doc_number=NULL,guardian=?,relationship=CASE WHEN trim(COALESCE(relationship,''))='' THEN 'Acudiente' ELSE relationship END,phone=?,modality='Mensual',consent=1,consent_date='2026-10-01',status='active',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),version=version+1 WHERE "+where).bind(name,dob,category,docType,guardian,phone,name,dob));
      statements.push(database.prepare("INSERT INTO athletes (id,name,dob,category,doc_type,doc_number,address,guardian,relationship,phone,email,emergency_name,emergency_relation,emergency_phone,health_notes,modality,consent,consent_date,status,created_by,created_at,updated_at,version) SELECT ?,?,?,?,?,NULL,'',?,'Acudiente',?,NULL,'','','','','Mensual',1,'2026-10-01','active','felipe',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),1 WHERE NOT EXISTS (SELECT 1 FROM athletes WHERE "+where+")").bind(id,name,dob,category,docType,guardian,phone,name,dob));
      statements.push(database.prepare("INSERT OR IGNORE INTO audit (id,actor,action,entity_id,created_at) SELECT ?, 'felipe','athlete_imported_excel',id,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM athletes WHERE "+where+" LIMIT 1").bind('excel-import-20261013-'+String(n).padStart(3,'0'),name,dob));
    }
  }
  for(let i=0;i<statements.length;i+=75)await database.batch(statements.slice(i,i+75));
  await database.prepare("INSERT OR IGNORE INTO audit(id,actor,action,entity_id,created_at) VALUES (?, 'felipe','athlete_import_batch',?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(SENTINEL,SENTINEL).run();
}
