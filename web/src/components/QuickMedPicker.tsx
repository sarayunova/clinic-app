import { useState } from 'react';
import {
  QUICK_MEDICATIONS,
  type QuickMedication,
} from '../medicationCatalog';

const CATEGORIES = ['All', 'Antenatal', 'Obstetric & Gynae', 'General'] as const;
type Category = (typeof CATEGORIES)[number];

interface Props {
  onSelect: (med: QuickMedication) => void;
  disabled?: boolean;
}

export function QuickMedPicker({ onSelect, disabled = false }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [recentAdded, setRecentAdded] = useState<string | null>(null);

  const filtered =
    activeCategory === 'All'
      ? QUICK_MEDICATIONS
      : QUICK_MEDICATIONS.filter((m) => m.category === activeCategory);

  const handleSelect = (m: QuickMedication) => {
    if (disabled) return;
    onSelect(m);
    setRecentAdded(m.name);
    setTimeout(() => {
      setRecentAdded((curr) => (curr === m.name ? null : curr));
    }, 2000);
  };

  return (
    <div className="quick-meds-box">
      <div className="quick-meds-head">
        <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>⚡ Quick-Add Common Medicines:</strong>
          {recentAdded && (
            <span className="badge ok small" style={{ animation: 'fadein 0.2s' }}>
              ✓ Added {recentAdded}
            </span>
          )}
        </div>
        <div className="quick-meds-tabs" role="tablist">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={activeCategory === cat ? 'active' : ''}
              onClick={() => setActiveCategory(cat)}
              disabled={disabled}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="chips rx-chips">
        {filtered.map((m) => (
          <button
            key={m.id}
            type="button"
            className="chip-btn pill-add"
            onClick={() => handleSelect(m)}
            disabled={disabled}
            title={`${m.medicine} ${m.strength} (${m.frequency}, ${m.duration})`}
          >
            + {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
