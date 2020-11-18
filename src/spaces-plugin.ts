import {
  createClient
} from '@remixproject/plugin-webview';
import {
  PluginClient
} from '@remixproject/plugin';
import {
  default as Box
} from '3box';
import {
  getAddress
} from '@ethersproject/address';
import $ from 'jquery';

//import * as fs from 'fs';

const enum Steps {
  connect,
  login,
  logout,
  noMetaMask
};


export class SpacePlugin extends PluginClient {

  step: number;
  mainBtn: HTMLButtonElement;
  enable: boolean;
  ethereumProvider: any; // TODO check if MetaMask has types
  address: string;
  client: any
  // 3Box doesn't support TypeScript :(
  box: any;
  spaces: Record < string,
  any > ;

  constructor() {
    
   // console.clear();
    
    super();

    
    this.client = createClient(this)
    this.client.onload().then(async () => {
      console.log("client loaded", this)
      $("#main-btn").click(async () => {
        await this.connector()
      })
    })
    this.enable = false;
    this.step = Steps.connect;
    this.mainBtn = document.querySelector < HTMLButtonElement > ('#main-btn') !;
    this.ethereumProvider = window['ethereum'];
    this.spaces = {};
    this.methods = [
      'login', // connect metamask to this plugin, then login to 3box
      'isEnabled', // return true is metamask AND 3box are connected/logged to this plugin
      'getUserAddress', // return the user's metamask eth address
      'openSpace', // open a space named after the plugin that call this function
      'closeSpace', // close the space named after the plugin that call this function
      'isSpaceOpened', // return true if the calling plugin has already an opened space
      'getSpacePrivateValue',
      'setSpacePrivateValue',
      'getSpacePublicValue',
      'setSpacePublicValue',
      'getSpacePublicData',
      'getSpaceName' // Gives the name of the space currently used
    ];

    if (!this.ethereumProvider || !this.ethereumProvider.isMetaMask) {
      this.step = Steps.noMetaMask;
      this.mainBtn.innerHTML = 'Download MetaMask to continue';
      this.mainBtn.disabled = true;
    }
  }

  public async ipfs(){
    // const defaultHost = 'ipfs.komputing.org' // ethdev berlin ipfs node
    // const defaultPort = 443
    // const defaultProtocol = 'https'
    // let ipfs = IpfsHttpClient.create(
     
    // )

    // let i = await ipfs.add({
    //   path:"/tuts/yann.txt",
    //   content:"genius",
    //   mode:"string"
    // })

    // console.log(i);
  }

  /** 
   * this function handle the ui and the plugin life cycle,
   * it is called every time the user click on the main button
   */
  private async connector() {
    this.requireLoaded();

    switch (this.step) {
      case Steps.connect:
      case Steps.login:
        this.login();
        break;
      case Steps.logout:
        this.logout();
        break;
      default:
        console.warn('Please Download MetaMask to continue'); // TODO better error
        break;
    }
  }

  //-----------------------------------------
  //        FUNCTIONS EXPOSED TO CALL
  //-----------------------------------------

  public async login() {
    try {
      if (this.requireLoaded()) return false;

      if (this.step === Steps.connect) {
        const [address] = await this.ethereumProvider.enable();

        this.address = getAddress(address);
        this.step = Steps.connect;
        this.mainBtn.innerHTML = 'Login to 3Box';
        this.emit('enabled');
      }

      if (this.step === Steps.login) {
        return true;
        console.log(this.address);
        try {
          //this.box = await Box.create(this.ethereumProvider);
          this.box = await Box.openBox(this.address, this.ethereumProvider);
          this.step = Steps.logout;
          this.enable = true;
          this.mainBtn.innerHTML = 'Logout';
          this.emit('loggedIn');
          await this.openSpace();
          this.setSpacePublicValue("yann","genius")
          console.log(this.getSpacePublicValue("yann").then((x)=>{console.log(x)}));
          
        } catch (err) {
          console.log(err)
          throw err;
        }



        return true;
      }

      return false;
    } catch (err) {
      throw err;
    }
  }

  private logout() {
    console.log("logout");
    delete this.address;
    delete this.box;
    this.spaces = {};
    this.enable = false;
    this.step = Steps.connect;
    this.mainBtn.innerHTML = 'Connect MetaMask';
    this.emit('loggedOut');
    return true;
  }

  public getSpaceName() {
    if (typeof this.currentRequest != "undefined") {
      return `remix-${this.currentRequest.from}`;
    } else {
      return `remix-workspace`;
    }
  }

  public getUserAddress() {
    if (this.requireLoaded()) return;
    return this.address;
  }

  public isEnabled() {
    if (this.requireLoaded()) return;
    return this.enable;
  }

  public isSpaceOpened() {
    if (this.requireEnabled()) return;
    return !!this.spaces[this.getSpaceName()];
  }

  public async openSpace() {
    try {
      if (this.requireEnabled()) return false;
      const space = await this.box.openSpace(this.getSpaceName());
      this.spaces[this.getSpaceName()] = space;
      this.emit('spaceOpened', this.getSpaceName());
      console.log(this.spaces)
      return true;
    } catch (err) {
      console.error('An error happened during "openSpace()" :', err);
      return false;
    }
  }

  public closeSpace() {
    if (this.requireEnabled()) return false;
    delete this.spaces[this.getSpaceName()];
    this.emit('spaceClosed', this.getSpaceName());
    return true;
  }

  public getSpacePrivateValue(key: string) {
    if (this.requireSpaceOpened(this.getSpaceName())) return;
    return this.spaces[this.getSpaceName()].private.get(key);
  }

  public setSpacePrivateValue(key: string, value: string) {
    if (this.requireSpaceOpened(this.getSpaceName())) return;
    return this.spaces[this.getSpaceName()].private.set(key, value);
  }

  public getSpacePublicValue(key: string) {
    if (this.requireSpaceOpened(this.getSpaceName())) return;
    return this.spaces[this.getSpaceName()].public.get(key);
  }

  public setSpacePublicValue(key: string, value: string) {
    if (this.requireSpaceOpened(this.getSpaceName())) return;
    return this.spaces[this.getSpaceName()].public.set(key, value);
  }

  public getSpacePublicData(address: string, spaceName: string = this.getSpaceName()) {
    if (this.requireEnabled()) return;
    return Box.getSpace(address, spaceName);
  }

  //-----------------------------------------
  //                 CHECKS
  //-----------------------------------------

  private requireLoaded() {
    if (!this.isLoaded) {
      console.error('Space Plugin is not yet loaded on the IDE !');
      return true;
    }
    return false;
  }

  private requireEnabled() {
    if (this.requireLoaded() || !this.enable) {
      console.error('Space Plugin is not yet enabled ! Please connect MetaMask and Login to 3Box.');
      return true;
    }
    return false;
  }

  private requireSpaceOpened(spaceName: string) {
    if (this.requireEnabled() || !this.spaces[spaceName]) {
      console.error('Unkown Space ! Please call openSpace() before.');
      return true;
    }
    return false;
  }
}