import * as $ from './modules/Util';

import { Tweakable } from './modules/Tweakable';

class MyObject extends Tweakable {
  public position: { x: number; y: number };
  public size: number;
  public color: string;
  private div!: HTMLDivElement;
  
  constructor() {
    super();
    this.position = { x: 0, y: 0 };
    this.size = 10;
    this.color = '#ff0000';
    this.setupProp('position',{
      x: {min: 0, max: 500},
      y: {min: 0, max: 500},
    });
    this.setupProp('size');
    this.setupProp('color');
    this.addHtml()
  }

  private addHtml() {
    this.div = document.createElement('div');
    this.updateHtml()
    document.body.appendChild(this.div);
  }
  private updateHtml() {
    this.div.style.width = `${this.size}px`;
    this.div.style.height = `${this.size}px`;
    this.div.style.backgroundColor = this.color;
    this.div.style.position = 'absolute';
    this.div.style.top = `${this.position.y}px`;
    this.div.style.left = `${this.position.x}px`;
  }
  change() {
    super.change()
    this.updateHtml()
  }
}

class App {
  public myObject: MyObject;
  constructor() {
    this.myObject = new MyObject();
    this.init();
  }
  init() {
    $.addEvent(document, 'DOMContentLoaded', this.loaded.bind(this));
    $.addEvent(window, 'resize', this.resize.bind(this));
  }

  loaded() {
    $.addClass(document.body, 'loaded');
    console.log('loaded');
  }
  resize() {
    window.winW = window.innerWidth;
    window.winH = window.innerHeight;
  }
}

declare global {
  interface Window { 
    app: App;
    winW: number;
    winH: number;
  }
}

window.app = new App();


