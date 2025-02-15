import { DialogModule } from '@angular/cdk/dialog'
import { OverlayModule } from '@angular/cdk/overlay'
import { CommonModule } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  Renderer2,
  ViewChildren,
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { BehaviorSubject, combineLatest, firstValueFrom, map, take, tap } from 'rxjs'

import { NwModule } from '~/nw'
import { DataTableModule } from '~/ui/data-table'
import { ItemDetailModule } from '~/widgets/item-detail'

import { GearsetRecord, GearsetSlotStore, ItemInstance, ItemInstancesStore } from '~/data'
import { EquipSlot, EquipSlotId, EQUIP_SLOTS, getItemId, getItemMaxGearScore } from '~/nw/utils'
import { deferStateFlat, shareReplayRefCount, tapDebug } from '~/utils'
import { ItemDetailComponent } from '~/widgets/item-detail/item-detail.component'
import { InventoryPickerService } from '../inventory/inventory-picker.service'
import { Housingitems, ItemDefinitionMaster } from '@nw-data/types'
import { svgEllipsisVertical, svgLink16p, svgLinkSlash16p, svgPlus, svgRotate, svgTrashCan } from '~/ui/icons/svg'
import { IconsModule } from '~/ui/icons'
import { TooltipModule } from '~/ui/tooltip'
import { LayoutModule } from '~/ui/layout'
import { ItemFrameModule } from '~/ui/item-frame'

export interface GearsetSlotVM {
  slot?: EquipSlot
  gearset?: GearsetRecord
  instanceId?: string
  instance?: ItemInstance
  canRemove?: boolean
  canBreak?: boolean
  isEqupment?: boolean
  isRune?: boolean
  item?: ItemDefinitionMaster | Housingitems
}

@Component({
  standalone: true,
  selector: 'nwb-gearset-pane-slot',
  templateUrl: './gearset-pane-slot.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NwModule,
    DialogModule,
    FormsModule,
    ItemDetailModule,
    DataTableModule,
    IconsModule,
    LayoutModule,
    TooltipModule,
    ItemFrameModule,
  ],
  providers: [GearsetSlotStore],
  host: {
    class: 'block bg-black rounded-md flex flex-col overflow-hidden',
  },
})
export class GearsetPaneSlotComponent {
  @Input()
  public set slot(value: EquipSlot) {
    this.slot$.next(value)
  }
  public get slot() {
    return this.slot$.value
  }

  @Input()
  public set slotId(value: EquipSlotId) {
    this.slot$.next(EQUIP_SLOTS.find((it) => it.id === value))
  }

  @Input()
  public set gearset(value: GearsetRecord) {
    this.gearset$.next(value)
  }
  public get gearset() {
    return this.gearset$.value
  }

  @Output()
  public itemRemove = new EventEmitter<void>()

  @Output()
  public itemUnlink = new EventEmitter<ItemInstance>()

  @Output()
  public itemInstantiate = new EventEmitter<ItemInstance>()

  @Input()
  public compact: boolean

  @Input()
  public square: boolean

  @Input()
  public disabled: boolean

  @ViewChildren(ItemDetailComponent)
  protected itemDetail: QueryList<ItemDetailComponent>
  protected iconRemove = svgTrashCan
  protected iconLink = svgLink16p
  protected iconLinkBreak = svgLinkSlash16p
  protected iconPlus = svgPlus
  protected iconChange = svgRotate
  protected iconMenu = svgEllipsisVertical

  protected vm$ = deferStateFlat<GearsetSlotVM>(() =>
    combineLatest({
      slot: this.slot$,
      gearset: this.gearset$,
      instanceId: this.store.instanceId$,
      instance: this.store.instance$,
      isEqupment: this.store.isEqupment$,
      canRemove: this.store.canRemove$,
      canBreak: this.store.canBreak$,
      item: this.store.item$,
      isRune: this.slot$.pipe(map((it) => it.id === 'heartgem')),
    })
  )
    .pipe(
      tap((it) => {
        this.updateClass('screenshot-hidden', !it?.item)
        this.updateClass('hidden', !it?.item && this.disabled)
      })
    )
    .pipe(shareReplayRefCount(1))

  private slot$ = new BehaviorSubject<EquipSlot>(null)
  private gearset$ = new BehaviorSubject<GearsetRecord>(null)

  protected gearScore: number
  protected gsTarget: Element

  public constructor(
    private store: GearsetSlotStore,
    private itemsStore: ItemInstancesStore,
    private picker: InventoryPickerService,
    private renderer: Renderer2,
    private elRef: ElementRef<HTMLElement>
  ) {
    //
  }

  public ngOnInit(): void {
    this.store.useSlot(
      combineLatest({
        gearset: this.gearset$,
        slot: this.slot$,
      })
    )
  }

  protected async pickItem({ slot, instance }: GearsetSlotVM) {
    if (slot.itemType === 'Trophies') {
      this.picker
        .pickHousingItem({
          title: 'Choose item for slot',
          itemId: instance ? [instance.itemId] : [],
          multiple: false,
          category: this.slot.itemType,
        })
        .pipe(take(1))
        .subscribe(([item]) => {
          this.store.updateSlot({
            instance: {
              itemId: getItemId(item),
              gearScore: null,
              perks: {},
            },
          })
        })
    } else {
      this.picker
        .pickItem({
          title: 'Choose item for slot',
          itemId: instance ? [instance.itemId] : [],
          multiple: false,
          category: this.slot.itemType,
        })
        .pipe(take(1))
        .subscribe(([item]) => {
          this.store.updateSlot({
            instance: {
              itemId: getItemId(item),
              gearScore: getItemMaxGearScore(item),
              perks: {},
            },
          })
        })
    }
  }

  protected openGsEditor(event: MouseEvent) {
    this.gsTarget = event.currentTarget as Element
  }
  protected closeGsEditor() {
    this.gsTarget = null
  }

  protected pickPerk({ instance }: GearsetSlotVM, key: string) {
    this.picker
      .choosePerk(instance, key)
      .pipe(take(1))
      .subscribe((perk) => {
        this.store.updatePerk({ perk, key })
      })
  }

  protected async linkItem(it: GearsetSlotVM) {
    this.picker
      .pickInstance({
        title: 'Pick item',
        store: this.itemsStore,
        category: it.slot.itemType,
        selection: [it.instanceId],
        multiple: false,
      })
      .pipe(take(1))
      .subscribe((it) => {
        this.store.updateSlot({
          instanceId: it[0],
        })
      })
  }

  protected updateGearScore(value: number) {
    this.gearScore = value
  }

  protected commitGearScore({}: GearsetSlotVM) {
    this.store.updateGearScore({ gearScore: this.gearScore })
  }

  protected async breakLink() {
    const instance = await firstValueFrom(this.store.instance$)
    this.itemUnlink.next(instance)
  }

  protected remove() {
    this.itemRemove.next()
  }

  protected async instantiate() {
    const instance = await firstValueFrom(this.store.instance$)
    this.itemInstantiate.next(instance)
  }

  private updateClass(name: string, hasClass: boolean) {
    if (hasClass) {
      this.renderer.addClass(this.elRef.nativeElement, name)
    } else {
      this.renderer.removeClass(this.elRef.nativeElement, name)
    }
  }
}
