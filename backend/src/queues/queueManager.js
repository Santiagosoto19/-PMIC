import { EventEmitter } from 'events';

class Queue extends EventEmitter {
  constructor(nombre) {
    super();
    this.nombre = nombre;
    this._items = [];
    this._activos = 0;
    this._total = 0;
    this._fin = 0;
    this._esperados = 0; // ⭐ Cuántos items se esperan en total
  }

  // Indicar cuántos items se esperan (para colas que reciben items desde otra etapa)
  setEsperados(n) {
    this._esperados = n;
  }

  push(item) {
    this._items.push(item);
    this._total += 1;
    this.emit('itemDisponible');
  }

  pushMuchos(items) {
    items.forEach(item => {
      this._items.push(item);
      this._total += 1;
      this.emit('itemDisponible');
    });
  }

  pop() {
    if (this._items.length === 0) return null;
    this._activos += 1;
    return this._items.shift();
  }

  terminarItem() {
    this._activos -= 1;
    this._fin += 1;

    // La cola está vacía cuando:
    // - No hay items pendientes ni activos
    // - Ya se procesaron todos los esperados (si se definieron)
    if (this._items.length === 0 && this._activos === 0) {
      if (this._esperados === 0 || this._fin >= this._esperados) {
        this.emit('colaVacia');
      }
    }
  }

  get estaVacia() {
    if (this._esperados > 0) {
      return this._fin >= this._esperados && this._items.length === 0 && this._activos === 0;
    }
    return this._items.length === 0 && this._activos === 0 && this._total > 0;
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
    this.descarga = new Queue('DESCARGA');
    this.redimension = new Queue('REDIMENSION');
    this.conversion = new Queue('CONVERSION');
    this.marcaAgua = new Queue('MARCA_AGUA');
  }

  resetear() {
    this.descarga = new Queue('DESCARGA');
    this.redimension = new Queue('REDIMENSION');
    this.conversion = new Queue('CONVERSION');
    this.marcaAgua = new Queue('MARCA_AGUA');
  }

  resumen() {
    return {
      descarga: { pendientes: this.descarga.pendientes, activos: this.descarga._activos, procesados: this.descarga._fin },
      redimension: { pendientes: this.redimension.pendientes, activos: this.redimension._activos, procesados: this.redimension._fin },
      conversion: { pendientes: this.conversion.pendientes, activos: this.conversion._activos, procesados: this.conversion._fin },
      marcaAgua: { pendientes: this.marcaAgua.pendientes, activos: this.marcaAgua._activos, procesados: this.marcaAgua._fin },
    };
  }
}

export { QueueManager };