import * as $ from './Util';
import Swup, { type Handler, Location } from "swup";
import SwupFragmentPlugin, {
  type Rule as FragmentRule,
} from "@swup/fragment-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupA11yPlugin from "@swup/a11y-plugin";
import SwupScrollPlugin from "@swup/scroll-plugin";
import ParallelPlugin from "@swup/parallel-plugin";
import SwupDebugPlugin from '@swup/debug-plugin';

// const closeModal = () => {
//   const closeLink = document.querySelector(
//     "a.character_close"
//   ) as HTMLAnchorElement;
//   if (closeLink) swup.navigate(closeLink.href);
// };


// swup.hooks.on("animation:in:start", async (context) => {
//   await sleep(20000);
// });

/**
 * Close eventual modals using the Escape key
 */
// const onKeyDown = (e: KeyboardEvent) => {
//   if (e.metaKey) return;

//   switch (e.key) {
//     case "Escape":
//       closeModal();
//       break;
//   }
// };
// window.addEventListener("keydown", onKeyDown);

export class PageTransitionManager {
  swup: Swup;
  rules: FragmentRule[] = [];
  constructor() {
    this.rules = [
      {
        from: "/:lang/:category",
        to: "/:lang/about",
        containers: ["#about-modal"],
      },
    ];
    const rules = this.rules
    this.swup = new Swup({
      animateHistoryBrowsing: false,
      cache: false,
      plugins: [
        // new SwupDebugPlugin({}),
        new SwupFragmentPlugin({
          rules,
          // debug: true,
        }),
        new SwupPreloadPlugin({ preloadVisibleLinks: true }),
        new SwupHeadPlugin(),
        new SwupA11yPlugin(),
        new ParallelPlugin(),
        new SwupScrollPlugin({
          // offset: () => {
          //   const header = document.querySelector(".global-header") as HTMLElement;
          //   return header.offsetHeight + 15;
          // },
        }),
      ],
    });
    
    this.swup.hooks.on('visit:start', () => {
      console.log("🚀 : visit:start=====")
      
    });
    this.swup.hooks.on("page:load", () => {
      console.log("🚀 : page:load=====")
      
    });
    this.swup.hooks.on("content:replace", () => {
      console.log("🚀 : content:replace=====")
      const from = this.swup.visit.from.url
      const to = this.swup.visit.to.url
      // if(from){
      //   const modalClose = $.qsa(".modal_close")
      //   modalClose.forEach(element => {
      //     element.setAttribute("href", from)
      //   })
      // }
    });
    this.swup.hooks.on("page:view", () => {
      console.log("🚀 : page:view=====")
    });
    this.swup.hooks.on('animation:in:start', () => {
      console.log("🚀 : animation:in:start=====")
    });
    this.swup.hooks.on("visit:end", () => {
      console.log("🚀 : visit:end=====")
    });
  }
}
