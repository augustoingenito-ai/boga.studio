import { test, expect } from '@playwright/test';
import pg from 'pg';
import { postgresOptions, connectionError } from '../database-config.js';
const uri='postgresql://postgres.test-project:[YOUR-PASSWORD]@pooler.example.com:5432/postgres';
test('pg recibe contraseña literal separada con caracteres especiales, espacios y TLS verificado',()=>{
 const password='Fixture only @#:/%+?[] !';
 const config=postgresOptions({DATABASE_URL:uri,DATABASE_PASSWORD:password,DATABASE_CA_CERT:'line1\\nline2'});
 const client=new pg.Client(config);
 expect(client.connectionParameters.password).toBe(password);
 expect(client.connectionParameters.user).toBe('postgres.test-project');
 expect(client.connectionParameters.host).toBe('pooler.example.com');
 expect(client.connectionParameters.ssl).toEqual({rejectUnauthorized:true,ca:'line1\nline2'});
 expect(config).not.toHaveProperty('connectionString');
});
test('se conserva el acceso con URI codificada y la contraseña separada tiene prioridad',()=>{
 const url='postgresql://postgres.test-project:old%40%23%25@pooler.example.com:5432/postgres?sslmode=no-verify';
 expect(postgresOptions({DATABASE_URL:url}).password).toBe('old@#%');
 const config=postgresOptions({DATABASE_URL:url,DATABASE_PASSWORD:'new@#%'});
 expect(new pg.Client(config).connectionParameters.password).toBe('new@#%');
 expect(config.ssl.rejectUnauthorized).toBe(true);
});
test('los errores de configuración no exponen la URI ni la contraseña',()=>{
 expect(()=>postgresOptions({DATABASE_URL:'not-a-url/fixture-secret'})).toThrow(/URI completa/);
 expect(()=>postgresOptions({DATABASE_URL:uri})).toThrow(/DATABASE_PASSWORD/);
 expect(connectionError('28P01')).toContain('DATABASE_PASSWORD');
 expect(connectionError('SELF_SIGNED_CERT_IN_CHAIN')).toContain('DATABASE_CA_CERT');
});
