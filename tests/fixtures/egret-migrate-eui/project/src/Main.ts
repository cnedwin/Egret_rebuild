// SPDX-License-Identifier: Apache-2.0
class TrialPanel extends eui.Component {
  heroAnchor!: eui.Group;
  meterFill!: eui.Rect;
  strikeButton!: eui.Button;
  guardButton!: eui.Button;
  restartButton!: eui.Button;
  countLabel!: eui.Label;
  roundLabel!: eui.Label;
  statusLabel!: eui.Label;
  resultLabel!: eui.Label;
  scoreCard!: eui.Component & { valueLabel: eui.Label };
}

class Main extends eui.UILayer {
  private panel!: TrialPanel;
  private guardian!: dragonBones.EgretArmatureDisplay;
  private storageKey = "lantern-guardian-best";
  private round = 1;
  private progress = 0;
  private best = 0;
  private sequence!: string[];

  protected createChildren(): void {
    this.open().catch(error => { console.error(error); });
  }

  private async open(): Promise<void> {
    await RES.loadConfig("resource/default.res.json","resource/");
    await new Promise<void>((resolve) => {
      const theme = new eui.Theme("resource/default.thm.json", this.stage);
      theme.addEventListener(eui.UIEvent.COMPLETE, () => resolve(), this);
    });
    await RES.loadGroup("preload");
    this.sequence = RES.getRes("trial").sequence;
    if (this.sequence.join(",") !== "strike,guard,strike") throw new Error("Unexpected trial data");
    this.best = Number(egret.localStorage.getItem(this.storageKey) || 0);
    this.panel = new TrialPanel();
    this.panel.width = 480;
    this.panel.height = 720;
    this.panel.skinName = "TrialSkin";
    this.panel.addEventListener(eui.UIEvent.CREATION_COMPLETE, this.startTrial, this);
    this.addChild(this.panel);
  }

  private startTrial(): void {
    const p = this.panel;
    p.removeEventListener(eui.UIEvent.CREATION_COMPLETE, this.startTrial, this);
    const factory = dragonBones.EgretFactory.factory;
    factory.parseDragonBonesData(RES.getRes("guardian_ske"));
    factory.parseTextureAtlasData(RES.getRes("guardian_tex_json"), RES.getRes("guardian_tex_png"));
    this.guardian = factory.buildArmatureDisplay("Guardian");
    this.guardian.x = 188;
    this.guardian.y = 95;
    p.heroAnchor.addChild(this.guardian);
    this.guardian.animation.play("idle", 0);
    p.strikeButton.addEventListener(egret.TouchEvent.TOUCH_TAP, this.strike, this);
    p.guardButton.addEventListener(egret.TouchEvent.TOUCH_TAP, this.guard, this);
    p.restartButton.addEventListener(egret.TouchEvent.TOUCH_TAP, this.restart, this);
    this.refresh();
    Object.defineProperty(globalThis,"__guardianControl",{
      value: () => ({
        round:this.round, progress:this.progress, best:this.best,
        storedBest:egret.localStorage.getItem(this.storageKey),
        finished:this.progress === this.sequence.length,
        pose:this.guardian.animation.lastAnimationName,
        animating:this.guardian.animation.isPlaying,
        countText:p.countLabel.text, resultText:p.resultLabel.text,
        layout:[p.actions?.x,p.actions?.y,p.strikeButton.x,p.guardButton.x,p.meterFill.width],
        parts:[p.heroAnchor.name,p.scoreCard.valueLabel.text,p.strikeButton.label]
      }),
      configurable:true
    });
  }

  private strike(): void { this.move("strike"); }
  private guard(): void { this.move("guard"); }
  private move(action: string): void {
    if(this.progress === this.sequence.length) return;
    this.guardian.animation.play(action,1);
    if (this.sequence[this.progress] !== action) {
      this.panel.statusLabel.text = "Try the highlighted sequence";
      return;
    }
    this.progress++;
    if(this.progress > this.best) {
      this.best = this.progress;
      egret.localStorage.setItem(this.storageKey,String(this.best));
    }
    this.refresh();
  }
  private restart(): void {
    this.round++;
    this.progress = 0;
    this.guardian.animation.play("idle",0);
    this.refresh();
  }
  private refresh(): void {
    const p = this.panel;
    p.roundLabel.text = "ROUND " + this.round;
    p.countLabel.text = this.progress + " / " + this.sequence.length;
    p.scoreCard.valueLabel.text = String(this.best);
    p.meterFill.width = 404 * this.progress / this.sequence.length;
    p.resultLabel.text = this.progress === this.sequence.length ? "Lantern lit!" : "Lantern unlit";
    p.statusLabel.text = this.progress === this.sequence.length ? "Trial complete" : "Next: " + this.sequence[this.progress].toUpperCase();
  }
}
