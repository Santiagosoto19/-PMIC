import { EventEmitter } from 'events';

class Queue extends EventEmitter {
  constructor(nombre) {
    super();
    this.nombre   = nombre;
    this._items   = [];
    this._activos = 0;
    this._total   = 0;
    this._fin     = 0;
  }

  push(item) {
    this._items.push(item);
    this._total += 1;
    this.emit('itemDisponible');
  }

// En queueManager.js — reemplaza pushMuchos
pushMuchos(items) {

  items.forEach(item => {
    this._items.push(item);
    this._total += 1;
    this.emit('itemDisponible'); // ← emitir por cada item, no al final
  });
}

  pop() {
    if (this._items.length === 0) return null;
    this._activos += 1;
    return this._items.shift();
  }

  terminarItem() {
    this._activos -= 1;
    this._fin     += 1;
    if (this._items.length === 0 && this._activos === 0) {
      this.emit('colaVacia');
    }
  }

  get estaVacia() {
    return this._items.length === 0 && this._activos === 0;
  }

  get pendientes() {
    return this._items.length;
  }

  esperarVacia() {
    return new Promise(resolve => {
      if (this.estaVacia) {
        resolve();
      } else {
        this.once('colaVacia', resolve);
      }
    });
  }
}

class QueueManager {
  constructor() {
    this.descarga    = new Queue('DESCARGA');
    this.redimension = new Queue('REDIMENSION');
    this.conversion  = new Queue('CONVERSION');
    this.marcaAgua   = new Queue('MARCA_AGUA');
  }

  resetear() {
    this.descarga    = new Queue('DESCARGA');
    this.redimension = new Queue('REDIMENSION');
    this.conversion  = new Queue('CONVERSION');
    this.marcaAgua   = new Queue('MARCA_AGUA');
  }

  resumen() {
    return {
      descarga:    { pendientes: this.descarga.pendientes,    activos: this.descarga._activos },
      redimension: { pendientes: this.redimension.pendientes, activos: this.redimension._activos },
      conversion:  { pendientes: this.conversion.pendientes,  activos: this.conversion._activos },
      marcaAgua:   { pendientes: this.marcaAgua.pendientes,   activos: this.marcaAgua._activos },
    };
  }
}

export { QueueManager };