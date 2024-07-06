import { Pane, FolderApi } from 'tweakpane';

type TweakableProperty = {
  [key: string]: any;
};

export class Tweakable {
  pane: Pane;
  private folder: FolderApi;
  
  constructor() {
    this.pane = new Pane();
    this.folder = this.pane.addFolder({ title: this.constructor.name });
  }
  
  public setupProp(key:string,bindingParams?:any) {
    const properties = this.getTweakableProperties();
    console.log(properties)
    const binding = this.folder.addBinding(this, key as keyof this, bindingParams);
    binding.on('change', (ev) => {
      this.change()
    });
  }

  change(){

  }
  
  private getTweakableProperties(): TweakableProperty {
    const properties: TweakableProperty = {};
    
    for (const key in this) {
      console.log(key)
      if (this.hasOwnProperty(key)) {
        properties[key] = (this as any)[key];
      }
    }
    
    return properties;
  }
}