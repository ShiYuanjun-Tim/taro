/**
 * Navigator online: https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine
 * Network Connection API: https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation
 */

const NetInfo = {
  addEventListener(/* type: string, handler: Function */): { remove: () => void } {
    
    return {
      remove: () => {}
    };
  },

  removeEventListener(/* type: string, handler: Function */): void {
    
  },

  isConnected: {
    addEventListener(/* type: string, handler: Function */): { remove: () => void } {
      return {
        remove: () => {}
      };
    },

    removeEventListener(/* type: string, handler: Function */): void {
      
    },

     
  }
};

export default NetInfo;