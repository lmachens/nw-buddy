import { Dialog, DialogConfig, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject } from '@angular/core'
import { environment } from 'apps/web/environments/environment'
import { from, map } from 'rxjs'
import { NwModule } from '~/nw'
import { IconsModule } from '~/ui/icons'
import { svgCircleCheck, svgCircleExclamation, svgCircleNotch, svgCopy, svgShareNodes } from '~/ui/icons/svg'
import { deferState } from '~/utils'
import { ShareObject, ShareService } from './share.service'

export interface ShareOptions {
  data: ShareObject<any>
  buildUrl: (cid: string) => string
}

@Component({
  standalone: true,
  selector: 'nwb-share-dialog',
  templateUrl: './share-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NwModule, IconsModule],
  host: {
    class: 'flex flex-col bg-base-100 rounded-md overflow-hidden',
  },
})
export class ShareDialogComponent {
  public static open(dialog: Dialog, config: DialogConfig<ShareOptions>) {
    return dialog.open(ShareDialogComponent, config)
  }

  protected state$ = deferState(() => {
    return from(this.web3.shareObject(this.data.data)).pipe(map((it) => {
      return {
        shareUrl: this.buildShareUrl(it.cid),
        ipfsUrl: this.web3.buildIpfsUrl(it.cid)
      }
    }))
  })

  protected iconError = svgCircleExclamation
  protected iconSuccess = svgCircleCheck
  protected iconShare = svgShareNodes
  protected iconCopy = svgCopy
  protected iconSpinner = svgCircleNotch

  protected copied = false
  public constructor(
    @Inject(DIALOG_DATA)
    private data: ShareOptions,
    private dialog: DialogRef,
    private web3: ShareService,
    private cdRef: ChangeDetectorRef
  ) {
    //
  }

  protected async copy(value: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => true)
      .catch(() => false)
      .then((value) => {
        this.copied = value
        this.cdRef.markForCheck()
      })
  }

  protected close() {
    this.dialog.close()
  }

  protected buildShareUrl(cid: string) {
    const path = this.data.buildUrl(cid)
    if (environment.production) {
      return `https://www.nw-buddy.de` + path
    }
    return location.origin + path
  }
}
