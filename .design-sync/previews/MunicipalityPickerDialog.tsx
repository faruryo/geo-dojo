import { MunicipalityPickerDialog } from 'geo-dojo';
import { yamagata } from './_municipalities';

export function Open() {
  return (
    <div style={{ background: '#111111', width: 390, height: 640 }}>
      <MunicipalityPickerDialog
        isOpen
        onOpenChange={() => {}}
        prefecture="山形県"
        municipalities={yamagata}
        selectedCodes={['06203', '06204']}
        onSave={() => {}}
        clearedCodesSet={new Set(['06201', '06202'])}
      />
    </div>
  );
}
