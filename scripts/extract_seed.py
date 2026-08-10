import openpyxl, json, math, datetime
SRC='/root/.claude/uploads/9fd7b7df-9bc7-50a6-8565-5c8fdd6af6d5/df4d262f-AKB_ADMISSION_2026_TO_2027NEW.xlsx'
wb=openpyxl.load_workbook(SRC, data_only=True)
ws=wb['DATA']

def num(v):
    if v is None or v=='' : return 0
    if isinstance(v,(int,float)):
        return 0 if (isinstance(v,float) and math.isnan(v)) else round(v,2)
    try:
        return round(float(str(v).replace(',','').strip()),2)
    except: return 0

def txt(v):
    if v is None: return ''
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    if isinstance(v,float) and v.is_integer(): return str(int(v))
    return str(v).strip()

# column indices (1-based) from header row 2
# fee heads: (key, label, total_col, paid_col, balance_col)  balance_col None => single paid value
HEADS=[
    ('term','Term Fees',20,21,22),
    ('supplies','School Supplies',23,24,25),
    ('uniform','Uniform & Accessories',27,28,29),
    ('transport','Transport Fees',30,31,32),
    ('summer_camp','Summer Camp',45,46,47),
]
students=[]
for r in range(3, ws.max_row+1):
    name=ws.cell(r,3).value
    if not name or not str(name).strip(): continue
    sid=txt(ws.cell(r,4).value)
    if not sid: continue
    heads={}
    for key,label,tc,pc,bc in HEADS:
        total=num(ws.cell(r,tc).value)
        paid=num(ws.cell(r,pc).value)
        bal=num(ws.cell(r,bc).value) if bc else 0
        # normalize: if total missing but paid+bal present derive; keep balance=total-paid when consistent
        if total==0 and (paid or bal): total=round(paid+bal,2)
        heads[key]={'label':label,'total':total,'paid':paid,'balance':round(total-paid,2)}
    app_paid=num(ws.cell(r,26).value)  # App Fees Paid (single)
    heads['app_fees']={'label':'App Fees','total':app_paid,'paid':app_paid,'balance':0}
    students.append({
        'id':sid,
        'name':txt(ws.cell(r,3).value),
        'grade':txt(ws.cell(r,5).value),
        'classTeacher':txt(ws.cell(r,6).value),
        'gender':txt(ws.cell(r,7).value),
        'dob':txt(ws.cell(r,8).value),
        'age':txt(ws.cell(r,9).value),
        'prevSchool':txt(ws.cell(r,10).value),
        'father':txt(ws.cell(r,11).value),
        'mother':txt(ws.cell(r,12).value),
        'location':txt(ws.cell(r,13).value),
        'dropLocation':txt(ws.cell(r,14).value),
        'transportType':txt(ws.cell(r,15).value),
        'vehicle':txt(ws.cell(r,16).value),
        'contact':txt(ws.cell(r,17).value),
        'religion':txt(ws.cell(r,18).value),
        'discount':num(ws.cell(r,19).value),
        'admission':txt(ws.cell(r,43).value),
        'fees':heads,
        'payments':[]  # payment ledger built by app; seed opening from paid values handled in app
    })
out='/home/user/akbschools/data/students.seed.json'
json.dump({'school':'AKB School of Excellence','year':'2026-2027','generated':'seed','students':students}, open(out,'w'), indent=1, ensure_ascii=False)
print('students:',len(students))
tot=sum(sum(h['total'] for h in s['fees'].values()) for s in students)
paid=sum(sum(h['paid'] for h in s['fees'].values()) for s in students)
print('total fees:',int(tot),'paid:',int(paid),'balance:',int(tot-paid))
import os; print('size KB:', round(os.path.getsize(out)/1024,1))
