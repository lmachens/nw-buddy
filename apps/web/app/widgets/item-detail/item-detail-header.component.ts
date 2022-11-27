import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { BehaviorSubject, combineLatest, defer, map, tap } from 'rxjs'
import { NwModule } from '~/nw'
import { ItemFrameModule } from '~/ui/item-frame'
import { ItemTrackerModule } from '../item-tracker'
import { ItemDetailHeaderBackdropComponent } from './item-detail-header-backdrop.component'
import { ItemDetailHeaderContentComponent } from './item-detail-header-content.component'
import { ItemDetailService } from './item-detail.service'

@Component({
  standalone: true,
  selector: 'nwb-item-detail-header',
  templateUrl: './item-detail-header.component.html',
  styleUrls: ['./item-detail-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NwModule,
    ItemTrackerModule,
    ItemDetailHeaderBackdropComponent,
    ItemDetailHeaderContentComponent,
    ItemFrameModule,
  ],
  host: {
    class: 'block',
  },
})
export class ItemDetailHeaderComponent {
  @Input()
  public enableInfoLink: boolean

  @Input()
  public set enableTracker(value: boolean) {
    this.enableTracker$.next(value)
  }

  protected name$ = this.detail.name$
  protected source$ = this.detail.source$
  protected rarity$ = this.detail.rarity$
  protected rarityName$ = this.detail.rarityName$
  protected tier$ = this.detail.tierLabel$

  protected get vm$() {
    return this.detail.vm$
  }

  protected showMarker$ = defer(() => this.enableTracker$)
  protected showGsMarker$ = defer(() =>
    combineLatest({
      enabled: this.enableTracker$,
      hasGs: this.detail.item$.pipe(map((it) => it?.ItemType === 'Weapon' || it?.ItemType === 'Armor')),
    })
  ).pipe(map(({ enabled, hasGs }) => enabled && hasGs))

  private enableTracker$ = new BehaviorSubject(false)

  public constructor(protected detail: ItemDetailService) {
    //
  }
}
