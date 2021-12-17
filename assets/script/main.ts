import { RayCast } from "./ray-cast.ts";

const { ccclass, property } = cc._decorator;


@ccclass
export class Main extends cc.Component {
    private touchPos: cc.Vec2;

    @property(cc.Prefab)
    ballPrefab: cc.Prefab = null;

    // radius: number;
    // angle: number;

    public onLoad() {
        { // 開啟物力系統
            let physicsManager = cc.director.getPhysicsManager();
            physicsManager.enabled = true;

            physicsManager.gravity = cc.v2();

            cc.director.getPhysicsManager().debugDrawFlags =
                cc.PhysicsManager.DrawBits.e_aabbBit |
                cc.PhysicsManager.DrawBits.e_jointBit |
                cc.PhysicsManager.DrawBits.e_shapeBit;
        }

        { // 開啟碰撞系統
            var manager = cc.director.getCollisionManager();
            manager.enabled = true;
            manager.enabledDebugDraw = true;
            manager.enabledDrawBoundingBox = true;
        }
    }

    public start() {
        this.restart();
    }

    public onEnable() {
        this.node.getChildByName("restart").on(cc.Node.EventType.TOUCH_START, this.restart, this);
        this.node.getChildByName("confirm").on(cc.Node.EventType.TOUCH_START, this.confirm, this);

        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.touchMode, this);
    }

    private touchMode(event: cc.Event.EventTouch) {
        this.updateCuePos(event.getLocation());
    }

    private updateCuePos(pos: cc.Vec2) {
        if (!pos) {
            pos = new cc.Vec2(this.node.width / 2, this.node.height / 2); // 中央
        }

        pos = this.node.convertToNodeSpaceAR(pos);

        this.touchPos = pos; // 暫存觸碰的位置

        let ballNode = this.node.getChildByName("ball_white");
        ballNode.rotation = 0; // FIXME 白球碰撞到牆壁後會導致球桿歪掉和射線無法跟隨觸碰位置

        let distance = ballNode.width / 2; // 球桿和白球的距離
        let backLocation = this.getCuePos(-distance, ballNode.getPosition(), pos);

        let cueNode = this.node.getChildByName("cue");
        cueNode.setPosition(backLocation);

        let pos2 = this.node.convertToWorldSpaceAR(pos);
        pos2 = ballNode.convertToNodeSpaceAR(pos2);
        cueNode.rotation = cc.misc.radiansToDegrees(pos2.signAngle(cc.v2(-1, 0)));

        let rayCastNode = this.node.getChildByName("rayCast");
        let rayCast = rayCastNode.getComponent(RayCast);
        rayCast.setPos(-1 * pos2.signAngle(cc.v2(1, 0)));
    }

    private getCuePos(distance: number, pointA: cc.Vec2, pointB: cc.Vec2): cc.Vec2 {
        let r = Math.sqrt(Math.pow((pointB.x - pointA.x), 2) + Math.pow((pointB.y - pointA.y), 2));

        let x = (distance * (pointB.x - pointA.x)) / r + pointA.x;
        let y = (distance * (pointB.y - pointA.y)) / r + pointA.y;

        let dx = x - pointA.x;
        let dy = y - pointA.y;

        return new cc.Vec2(pointA.x + dx, pointA.y + dy);
    }

    private confirm() {
        let forceNode = this.node.getChildByName("force");
        let slider = forceNode.getComponent(cc.Slider);

        let ballNode = this.node.getChildByName("ball_white");
        let cueNode = this.node.getChildByName("cue");

        let force = slider.progress
        if (force <= 0) {
            return;
        }

        { // 播放球桿打球動畫, 衝力越大拉桿距離越大 
            let distance = ballNode.width / 2; // 球桿和白球的距離
            distance += slider.progress * 2000;

            let srcPos = new cc.Vec2(cueNode.x, cueNode.y);
            let targetPos = this.getCuePos(-distance, ballNode.getPosition(), this.touchPos);

            let self = this;
            cc.tween(cueNode)
                .to(0.8, { position: targetPos }) // 後退到定點
                .delay(0.5) // 稍微等待
                .to(0.1, { position: srcPos }) // 恢復到原點
                .call(() => {
                    let angle = cueNode.rotation / 180 * Math.PI;
                    let dir = cc.v2(Math.cos(angle), Math.sin(angle));
                    dir.normalizeSelf();

                    let speed = distance;

                    let x = dir.x * speed * -1;
                    let y = dir.y * speed;

                    let rigidBody = ballNode.getComponent(cc.RigidBody);
                    rigidBody.linearVelocity = new cc.Vec2(x, y);
                })
                .start();
        }
    }

    public update(dt: number) {
        // 檢查全部的球是否都已經靜止(用來控制球桿是否顯示)
        let isSleep = function (rigidbody: cc.RigidBody): boolean {
            var linearVelocity = rigidbody.linearVelocity;
            var angularVelocity = rigidbody.angularVelocity;

            if (linearVelocity.x != 0 || linearVelocity.y != 0) {
                return false;
            }

            if (angularVelocity != 0) {
                return false;
            }

            return true;
        };

        let sleep = true;

        if (!isSleep(this.node.getChildByName("ball_white").getComponent(cc.RigidBody))) {
            sleep = false;
        } else {
            let ballOtherNode = this.node.getChildByName("ball_other");
            for (let i = 0; i < ballOtherNode.children.length; i++) {
                let rigidbody = ballOtherNode.children[i].getComponent(cc.RigidBody);
                if (!isSleep(rigidbody)) {
                    sleep = false;
                    break;
                }
            }
        }

        let ballNode = this.node.getChildByName("ball_white");
        let rigidBody = ballNode.getComponent(cc.RigidBody);
        rigidBody.active = !sleep;

        let rayCastNode = this.node.getChildByName("rayCast");
        rayCastNode.active = sleep;

        if (!sleep) {
            this.updateCuePos(null);
        }

        this.node.getChildByName("cue").active = sleep;
        this.node.getChildByName("restart").active = sleep;
        this.node.getChildByName("force").active = sleep;
        this.node.getChildByName("confirm").active = sleep;
    }

    private restart() {
        class Ball extends cc.Component {
            public value: string;
            public onCollisionEnter(other: cc.Collider, self: cc.Collider) {// 球碰撞到球袋
                if (this.value == "") { // 白球不做任何處理
                    return;
                }
                this.node.destroy(); // 1-15號球消失
            }
        }

        { // 放置 1-15號球
            let parentNode = this.node.getChildByName("ball_other");
            parentNode.destroyAllChildren();
            parentNode.setPosition(250, 0);

            let valueArr: string[] = []; // 要將15顆球的編號打亂
            {
                let getRandomInt = function (min, max) {
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                };

                for (let i = 1; i <= 15; i++) {
                    valueArr.push(i.toString());

                    let idx = getRandomInt(0, valueArr.length - 1);
                    let idx2 = getRandomInt(0, valueArr.length - 1);

                    let tmp = valueArr[idx];
                    valueArr[idx] = valueArr[idx2];
                    valueArr[idx2] = tmp;
                }
            }

            for (let i = 0; i < 5; i++) {
                let count = i + 1;

                for (let k = 0; k < count; k++) {


                    let node = cc.instantiate(this.ballPrefab);
                    let valueNode = node.getChildByName("value");

                    let value = valueArr.shift();

                    let ball = node.addComponent(Ball);
                    ball.value = value.toString();

                    valueNode.getComponent(cc.Label).string = value.toString(); // 球的編號

                    let x = (i * node.width);
                    let y = (k * node.height) - ((node.height * (count - 1)) / 2);

                    node.setPosition(x, y);

                    parentNode.addChild(node);
                }
            }
        }

        { // 重置白球和球桿
            let parentNode = this.node.getChildByName("ball_white");
            parentNode.setPosition(-250, 60);

            this.updateCuePos(null);
        }
    }
}
