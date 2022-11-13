import { Dialog, DialogModule } from '@angular/cdk/dialog'
import { CommonModule, DecimalPipe, PercentPipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, TemplateRef, ViewChild } from '@angular/core'
import {
  Ability,
  Affixstats,
  Damagetypes,
  ItemDefinitionMaster,
  ItemdefinitionsArmor,
  ItemdefinitionsWeapons,
  Perks,
} from '@nw-data/types'
import { sortBy, sumBy } from 'lodash'
import { combineLatest, defer, filter, firstValueFrom, map, Observable, of, shareReplay, switchMap } from 'rxjs'
import { GearsetRecord, GearsetStore, ItemInstance, ItemInstancesDB } from '~/data'
import { NwDamagetypeService, NwDbService, NwModule } from '~/nw'
import {
  EquipSlotId,
  EQUIP_SLOTS,
  getAffixABSs,
  getAffixDMGs,
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
import { ConfirmDialogComponent } from '~/ui/modal'
import { PropertyGridModule } from '~/ui/property-grid'
import { shareReplayRefCount } from '~/utils'
import { AttributeEditorDialogComponent, AttributeName, ATTRIBUTE_IDS } from '~/widgets/attributes-editor'

interface PerkInfo {
  perk: Perks
  count: number
  scale: number
  abilities: Array<Partial<Ability>>
  affix: Partial<Affixstats>
  maybeStackable?: boolean
  isWeapon: boolean
  isArmor: boolean
  isJewelery: boolean
  isShield: boolean
}

export interface StatEntry {
  key: string
  label: string[] | string
  value: number
  percent: number
  icon?: string
}

@Component({
  standalone: true,
  selector: 'nwb-gearset-stats',
  templateUrl: './gearset-stats.component.html',
  styleUrls: ['./gearset-stats.component.scss'] ,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NwModule, PropertyGridModule, DialogModule],
  providers: [PercentPipe, DecimalPipe],
  host: {
    class: 'block bg-base-100 rounded-md flex flex-col relative justify-end',
  },
})
export class GearsetStatsComponent {
  protected slots$ = this.resolveSlots().pipe(shareReplayRefCount(1))
  protected perkInfos$ = this.resolvePerkInfos().pipe(shareReplayRefCount(1))
  protected gearScore$ = this.slots$.pipe(map((slots) => this.sumGearScore(slots)))
  protected weight$ = this.slots$.pipe(map((slots) => this.sumWeight(slots)))
  protected elementalRating$ = this.slots$.pipe(map((slots) => this.sumRatingElemental(slots)))
  protected physicalRating$ = this.slots$.pipe(map((slots) => this.sumRatingPhysical(slots)))
  protected elementalAbs$ = combineLatest({ perks: this.perkInfos$, types: this.db.damagetypesMap }).pipe(
    map(({ perks, types }) => {
      return this.sumAbsorbtions(perks, types, 'Elemental')
    })
  )
  protected physicalAbs$ = combineLatest({ perks: this.perkInfos$, types: this.db.damagetypesMap }).pipe(
    map(({ perks, types }) => {
      return this.sumAbsorbtions(perks, types, 'Physical')
    })
  )
  protected otherAbs$ = combineLatest({ perks: this.perkInfos$, types: this.db.damagetypesMap }).pipe(
    map(({ perks, types }) => {
      return this.sumAbsorbtions(perks, types, null)
    })
  )
  protected dmg$ = combineLatest({ perks: this.perkInfos$, types: this.db.damagetypesMap }).pipe(
    map(({ perks, types }) => {
      return this.sumDamages(perks, types)
    })
  )
  protected attrsAssigned$ = this.store.gearsetAttrs$
  protected attrsBase$ = defer(() => this.perkInfos$).pipe(map((it) => this.sumMods(it)))
  protected attrs$ = combineLatest({
    base: this.attrsBase$,
    assigned: this.attrsAssigned$
  }).pipe(map(({ base, assigned }) => {
    return ATTRIBUTE_IDS.map((key) => {
      return {
        key: key,
        base: base?.[key] || 0,
        assigned: assigned?.[key] || 0,
      }
    })
  }))
  protected image$ = this.store.imageUrl$.pipe(shareReplay(1))
  protected hasImage$ = this.image$.pipe(map((it) => !!it ))

  public constructor(
    private db: NwDbService,
    private damage: NwDamagetypeService,
    private store: GearsetStore,
    private itemsDb: ItemInstancesDB,
    private dialog: Dialog
  ) {
    //
  }

  protected damageIcon(type: string) {
    return this.damage.wardTypeIcon(type) || this.damage.damageTypeIdIcon(type)
  }

  protected getPerkMultiplier(info: PerkInfo) {
    if (info.maybeStackable) {
      return info.count * info.scale
    }
    return info.scale
  }

  private resolveSlots() {
    return this.store.gearsetSlots$.pipe(
      switchMap((slots) => {
        const slots$ = Object.entries(slots || {}).map(([id, slot]) => {
          return this.resolveSlotInstance(slot).pipe(switchMap((instance) => this.resolveSlot(id, instance)))
        })
        return combineLatest(slots$)
      })
    )
  }

  private resolveSlotInstance(slot: string | ItemInstance) {
    if (typeof slot === 'string') {
      return this.itemsDb.live((t) => t.get(slot))
    }
    return of(slot)
  }

  private resolveSlot(id: string, instance: ItemInstance) {
    return combineLatest({
      items: this.db.itemsMap,
      perks: this.db.perksMap,
      armors: this.db.armorsMap,
      weapons: this.db.weaponsMap,
    }).pipe(
      switchMap(({ items, perks, armors, weapons }) => {
        const item = items.get(instance?.itemId)
        return this.resolveSlotPerks(instance, item, perks).pipe(
          map((perks) => {
            return {
              id: id,
              instance: instance,
              gearScore: instance?.gearScore ?? getItemMaxGearScore(item),
              item: item,
              armor: armors.get(item?.ItemStatsRef),
              weapon: weapons.get(item?.ItemStatsRef),
              perks: perks,
            }
          })
        )
      })
    )
  }

  private resolveSlotPerks(instance: ItemInstance, item: ItemDefinitionMaster, perks: Map<string, Perks>) {
    if (!item || !instance) {
      return of<Perks[]>([])
    }
    const fixedPerks = getItemPerkKeys(item)
      .map((key) => perks.get(instance?.perks?.[key] || item[key]))
      .filter((it) => !!it)
    const addedPerks = (getItemPerkBucketKeys(item) || [])
      .map((key) => perks.get(instance?.perks?.[key]))
      .filter((it) => !!it)
    return of([...fixedPerks, ...addedPerks])
  }

  private resolvePerkInfos() {
    return combineLatest({
      slots: this.slots$,
      affixMap: this.db.affixstatsMap,
      abilityMap: this.db.abilitiesMap,
    }).pipe(
      map(({ slots, affixMap, abilityMap }) => {
        const infos: Record<string, PerkInfo> = {}
        for (const slot of slots) {
          for (const perk of slot.perks) {
            if (infos[perk.PerkID]) {
              infos[perk.PerkID].count += 1
              continue
            }
            const affix = affixMap.get(perk.Affix)
            const abilities = perk.EquipAbility?.map((id) => abilityMap.get(id))?.map(stripAbilityProperties)
            infos[perk.PerkID] = {
              count: 1,
              perk: perk,
              scale: getPerkMultiplier(perk, slot.gearScore),
              affix: affix ? stripAffixProperties(affix) : null,
              abilities: abilities,
              maybeStackable: abilities?.some((it) => it.IsStackableAbility),
              isWeapon: !!slot.weapon,
              isArmor: !!slot.armor || perk?.ItemClass?.includes('Armor'),
              isJewelery:
                perk?.ItemClass?.includes('EquippableAmulet') ||
                perk?.ItemClass?.includes('EquippableToken') ||
                perk?.ItemClass?.includes('EquippableRing'),
              isShield:
                perk?.ItemClass?.includes('Shield') ||
                perk?.ItemClass?.includes('RoundShield') ||
                perk?.ItemClass?.includes('KiteShield') ||
                perk?.ItemClass?.includes('TowerShield'),
            }
          }
        }
        return Object.values(infos)
      })
    )
  }

  private sumWeight(slots: Array<{ item: ItemDefinitionMaster; armor: ItemdefinitionsArmor }>) {
    return sumBy(slots, (it) => (it?.armor ? it.armor.WeightOverride || it.item.Weight || 0 : 0))
  }
  private sumRatingElemental(
    slots: Array<{ gearScore: number; armor: ItemdefinitionsArmor; weapon: ItemdefinitionsWeapons }>
  ) {
    return sumBy(slots, (it) => {
      return getArmorRatingElemental(it.armor || it.weapon, it.gearScore)
    })
  }
  private sumRatingPhysical(
    slots: Array<{ gearScore: number; armor: ItemdefinitionsArmor; weapon: ItemdefinitionsWeapons }>
  ) {
    return sumBy(slots, (it) => {
      return getArmorRatingPhysical(it.armor || it.weapon, it.gearScore)
    })
  }
  private sumGearScore(slots: Array<{ id: string; gearScore: number }>) {
    return totalGearScore(slots.map((it) => ({ id: it.id as any, gearScore: it.gearScore })))
  }
  private sumAbsorbtions(infos: Array<PerkInfo>, types: Map<string, Damagetypes>, category: string) {
    const stats: Record<string, StatEntry> = {}
    for (const perk of infos) {
      if (perk.isArmor || perk.isJewelery || perk.isShield) {
        for (const mod of getAffixABSs(perk.affix, perk.scale)) {
          const type = types.get(mod.type)
          if ((!category && !type) || type?.Category === category) {
            stats[mod.key] = stats[mod.key] || { key: mod.key, label: mod.label, value: 0, percent: 0 }
            stats[mod.key].percent += Number(mod.value) * perk.count
            stats[mod.key].icon = this.damageIcon(mod.type)
          }
        }
      }
    }
    return Object.values(stats)
  }
  private sumDamages(infos: Array<PerkInfo>, types: Map<string, Damagetypes>) {
    const stats: Record<string, StatEntry> = {}
    for (const perk of infos) {
      if (perk.isArmor || perk.isJewelery || perk.isShield) {
        for (const mod of getAffixDMGs(perk.affix, perk.scale)) {
          stats[mod.key] = stats[mod.key] || { key: mod.key, label: mod.label, value: 0, percent: 0 }
          stats[mod.key].percent += Number(mod.value) * perk.count
          stats[mod.key].icon = this.damageIcon(mod.key.replace('DMG', ''))
        }
      }
    }
    return Object.values(stats)
  }
  private sumMods(infos: Array<PerkInfo>) {
    const mapping: Record<string, AttributeName> = {
      MODConstitution: 'con',
      MODDexterity: 'dex',
      MODFocus: 'foc',
      MODIntelligence: 'int',
      MODStrength: 'str',
    }
    const mods: Record<AttributeName, number> = {
      con: 5,
      dex: 5,
      foc: 5,
      int: 5,
      str: 5
    }
    for (const perk of infos) {
      for (const mod of getAffixMODs(perk.affix, perk.scale)) {
        const key = mapping[mod.key]
        if (key in mods) {
          mods[key] = mods[key] + Number(mod.value) * perk.count
        } else {
          console.warn('unknown mod', mod.key)
        }
      }
    }
    return mods
  }

  protected async editAttributes() {
    const base = await firstValueFrom(this.attrsBase$)
    const assigned = await firstValueFrom(this.attrsAssigned$)
    console.log({ base, assigned })
    AttributeEditorDialogComponent.open(this.dialog, {
      width: '100vw',
      maxWidth: 1200,
      data: {
        level: 60,
        assigned: assigned,
        base: base
      }
    }).closed
      .pipe(filter((it) => !!it))
      .subscribe((res) => {
        this.store.updateAttrs({ attrs: res })
      })
  }

  protected async uploadFile(e: Event) {
    const file = (e.target as HTMLInputElement)?.files?.[0]
    if (file.size > 1024*1024) {
      this.showFileTooLargeError()
      return
    }
    this.store.updateImage({ file: file })
  }

  protected showFileTooLargeError() {
    ConfirmDialogComponent.open(this.dialog, {
      data: {
        title: 'File too large',
        body: `
        Maximum file size is 1MB. Reduce image resolution or use an
        <a href="https://www.google.com/search?q=online+image+optimizer" target="_blank" tabindex="-1" class="link">image optimizer</a>
        `,
        html: true,
        positive: 'OK'
      }
    })
  }
}