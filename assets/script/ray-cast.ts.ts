const { ccclass, property } = cc._decorator;

@ccclass
export class RayCast extends cc.Component {

    rayCastType: cc.RayCastType;
    radius: number;

    angle: number;

    ctx: cc.Graphics;

    remainLength: number;

    onLoad() {
        this.rayCastType = cc.RayCastType.Closest;
        this.radius = 1000;

        this.ctx = this.getComponent(cc.Graphics);
        this.angle = 0;
    }

    start() {

    }

    public setPos(angle: number) {
        this.angle = angle;
    }

    update(dt) {
        let ballNode = this.node.parent.getChildByName("ball_white");
        let pos = ballNode.parent.convertToWorldSpaceAR(ballNode.getPosition());

        var p1 = pos;
        var p2 = cc.v2(Math.cos(this.angle), Math.sin(this.angle)).mulSelf(this.radius).addSelf(pos);

        this.ctx.clear();

        this.remainLength = this.radius;
        this.rayCast(p1, p2); 
    }

    rayCast(p1, p2) {
        var manager = cc.director.getPhysicsManager();
        var result = manager.rayCast(p1, p2, cc.RayCastType.Closest)[0];

        if (result) {
            p2 = result.point;
            this.ctx.circle(p2.x, p2.y, 8);
            this.ctx.fill();
        }

        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();

        if (!result) return;

        this.remainLength = this.remainLength - p2.sub(p1).mag();
        if (this.remainLength < 1) return;

        result.normal.mul(this.remainLength);

        p1 = p2;
        p2 = result.normal.mul(this.remainLength).add(p1);
        // this.rayCast(p1, p2);
    }
}
