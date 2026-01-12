/**
 * Déclaration de types globaux pour résoudre les incompatibilités Mongoose v6
 * Ces types forcent TypeScript à accepter les appels Mongoose standards
 */

declare module 'mongoose' {
  interface Model<T> {
    find(filter?: any, projection?: any, options?: any): any;
    findOne(filter?: any, projection?: any, options?: any): any;
    findById(id: any, projection?: any, options?: any): any;
    findByIdAndUpdate(id: any, update?: any, options?: any): any;
    findByIdAndDelete(id: any, options?: any): any;
    findOneAndUpdate(filter?: any, update?: any, options?: any): any;
    findOneAndDelete(filter?: any, options?: any): any;
    updateOne(filter?: any, update?: any, options?: any): any;
    updateMany(filter?: any, update?: any, options?: any): any;
    deleteOne(filter?: any, options?: any): any;
    deleteMany(filter?: any, options?: any): any;
    countDocuments(filter?: any, options?: any): any;
    aggregate(pipeline?: any[], options?: any): any;
  }
}

export {};
