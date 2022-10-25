import { Dialog, DialogModule } from '@angular/cdk/dialog'
import { CommonModule, DecimalPipe, PercentPipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, Input, TemplateRef, ViewChild } from '@angular/core'
import { Ability, Affixstats, Perks } from '@nw-data/types'
import { groupBy, sortBy } from 'lodash'
import { combineLatest, defer, map, ReplaySubject } from 'rxjs'
import { TranslateService } from '~/i18n'
import { NwDamagetypeService, NwDbService, NwModule } from '~/nw'
import {
  EquipSlotId,
  EQUIP_SLOTS,
  getAffixABSs,
  getAffixMODs,
  getArmorRatingElemental,
  getArmorRatingPhysical,
  getItemMaxGearScore,
  getItemPerkBucketKeys,
  getItemPerkKeys,
  getPerkMultiplier,
  stripAbilityProperties,
  stripAffixProperties,
  totalGearScore,
} from '~/nw/utils'
import { PropertyGridModule } from '~/ui/property-grid'
import { GearsetRecord } from './gearbuidler-store'

interface PerkDetailInfo {
  perk: Perks
  count: number
  scale: number
  abilities: Array<Partial<Ability>>
  affix: Partial<Affixstats>
  maybeStackable?: boolean
}

@Component({
  standalone: true,
  selector: 'nwb-gearbuilder-stats',
  templateUrl: './gearbuilder-stats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NwModule, PropertyGridModule, DialogModule],
  providers: [PercentPipe, DecimalPipe],
  host: {
    class: 'block bg-base-100 rounded-md flex flex-col relative',
  },
})
export class GearbuilderStatsComponent {
  @Input()
  public set entry(value: GearsetRecord) {
    this.entry$.next(value)
  }

  protected data$ = defer(() => this.resolvePerks())

  private entry$ = new ReplaySubject<GearsetRecord>()

  @ViewChild('tplSummary')
  protected tplSummary: TemplateRef<any>

  protected valueFormatter = (value: any, key?: string) => {
    if (typeof value !== 'number') {
      return value
    }
    return this.decimal.transform(value, '0.0-4')
  }

  public constructor(
    private db: NwDbService,
    private decimal: DecimalPipe,
    private dialog: Dialog,
    private damage: NwDamagetypeService,
    private i18n: TranslateService
  ) {
    //
  }

  protected damageIcon(type: string) {
    return this.damage.damageTypeIdIcon(type)
  }

  protected getPerkMultiplier(info: PerkDetailInfo) {
    if (info.maybeStackable) {
      return info.count * info.scale
    }
    return info.scale
  }

  protected showSummary() {
    this.dialog.closeAll()
    this.dialog.open(this.tplSummary, {
      panelClass: ['w-full', 'h-full', 'p-6', 'max-w-[2000px]'],
    })
  }

  private resolvePerks() {
    return combineLatest({
      entry: this.entry$,
      itemsMap: this.db.itemsMap,
      perksMap: this.db.perksMap,
      affixMap: this.db.affixstatsMap,
      abilityMap: this.db.abilitiesMap,
      armorsMap: this.db.armorsMap,
      weaponsMap: this.db.weaponsMap,
    }).pipe(
      map(({ entry, itemsMap, perksMap, affixMap, abilityMap, armorsMap, weaponsMap }) => {
        let weight = 0
        let ratingElemental = 0
        let ratingPhysical = 0
        const infos: Record<string, PerkDetailInfo> = {}
        const gsSlots: Array<{ id: EquipSlotId; gearScore: number }> = []

        const entries = Object.entries(entry.items || {}).filter(([slotId]) => {
          return EQUIP_SLOTS.some((it) => it.id === slotId)
        })
        for (const [slotId, slot] of entries) {
          const item = itemsMap.get(slot?.itemId)
          if (!item) {
            continue
          }

          const gearScore = slot.gearScore || getItemMaxGearScore(item)
          gsSlots.push({
            id: slotId as EquipSlotId,
            gearScore: gearScore,
          })

          const stats = armorsMap.get(item.ItemStatsRef) || weaponsMap.get(item.ItemStatsRef)
          weight += stats?.WeightOverride || item.Weight || 0
          ratingElemental += getArmorRatingElemental(stats, gearScore) || 0
          ratingPhysical += getArmorRatingPhysical(stats, gearScore) || 0

          const fixedPerks = getItemPerkKeys(item)
            .map((key) => perksMap.get(slot?.perks?.[key] || item[key]))
            .filter((it) => !!it)
          const addedPerks = (getItemPerkBucketKeys(item) || [])
            .map((key) => perksMap.get(slot?.perks?.[key]))
            .filter((it) => !!it)
          for (const perk of [...fixedPerks, ...addedPerks]) {
            if (infos[perk.PerkID]) {
              infos[perk.PerkID].count += 1
              continue
            }
            const affix = affixMap.get(perk.Affix)
            const abilities = perk.EquipAbility?.map((id) => abilityMap.get(id))?.map(stripAbilityProperties)
            infos[perk.PerkID] = {
              count: 1,
              perk: perk,
              scale: getPerkMultiplier(perk, gearScore),
              affix: affix ? stripAffixProperties(affix) : null,
              abilities: abilities,
              maybeStackable: abilities?.some((it) => it.IsStackableAbility),
            }
          }
        }
        const perks = Object.values(infos)
        const summary = this.collectStats(perks)

        summary.unshift({
          key: 'armor-rating-physical',
          label: 'Armor Rating - Physical',
          value: ratingPhysical,
          percent: 0,
        })
        summary.unshift({
          key: 'armor-rating-elemetnal',
          label: 'Armor Rating - Elemental',
          value: ratingElemental,
          percent: 0,
        })
        return {
          perks: perks,
          stackable: perks.filter((it) => it.maybeStackable),
          summary: summary,
          gearScore: totalGearScore(gsSlots),
          weight,
        }
      })
    )
  }

  private collectStats(data: PerkDetailInfo[]) {
    const stats: Record<string, { key: string; label: string[] | string; value: number; percent: number, icon?: string }> = {}
    for (const info of data) {
      for (const mod of getAffixMODs(info.affix, info.scale)) {
        stats[mod.key] = stats[mod.key] || { key: mod.key, label: [mod.label], value: 0, percent: 0 }
        stats[mod.key].value += Number(mod.value) * info.count
      }
      for (const mod of getAffixABSs(info.affix, info.scale)) {
        stats[mod.key] = stats[mod.key] || { key: mod.key, label: mod.label, value: 0, percent: 0 }
        stats[mod.key].percent += Number(mod.value) * info.count
        stats[mod.key].icon = this.damageIcon(mod.key.replace('ABS', ''))
      }
    }
    return sortBy(Object.values(stats), (it) => it.key)
  }
}